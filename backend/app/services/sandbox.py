"""Bubblewrap-backed Linux runner for isolated Python coding exercises.

Execution requires bubblewrap user/PID/network namespaces and is resource-limited.
The runner fails closed when the isolation toolchain is unavailable. This does
not replace independent security review or a dedicated production execution
service; hosted API code execution remains disabled by default.
"""

import os
import resource
import shutil
import signal
import subprocess
import tempfile
import time
from dataclasses import dataclass
from typing import Literal


@dataclass
class ExecutionResult:
    """Result of code execution."""
    status: Literal["success", "error", "timeout", "runtime_error"]
    stdout: str
    stderr: str
    exit_code: int
    execution_time_ms: int
    memory_used_kb: int | None = None


@dataclass
class TestResult:
    """Result of running a single test case."""
    name: str
    passed: bool
    expected: str
    actual: str
    error: str | None = None


@dataclass
class EvaluationResult:
    """Complete evaluation of a code submission."""
    status: Literal["passed", "failed", "error", "timeout"]
    test_results: list[TestResult]
    stdout: str
    stderr: str
    execution_time_ms: int
    passed_count: int
    total_count: int
    feedback: str


class SandboxConfig:
    """OS-enforced Linux sandbox limits. Missing bubblewrap fails closed."""
    TIMEOUT_SECONDS = 5
    MEMORY_LIMIT_MB = 128
    MAX_OUTPUT_SIZE = 10 * 1024
    MAX_CODE_SIZE = 50 * 1024
    MAX_INPUT_SIZE = 50 * 1024
    PYTHON_EXECUTABLE = os.getenv("SANDBOX_PYTHON", "/usr/bin/python3")
    BWRAP_EXECUTABLE = os.getenv("SANDBOX_BWRAP", "bwrap")


class CodeSandbox:
    """Execute Python inside bubblewrap namespaces with OS resource limits.

    The runner fails closed if bubblewrap or its configured interpreter is not
    available. This is a defense-in-depth local runner, not a claim of immunity
    to kernel/runtime vulnerabilities; production use still requires a reviewed
    isolated execution service and deployment-specific hardening.
    """
    
    def __init__(self, config: SandboxConfig | None = None):
        self.config = config or SandboxConfig()
    
    def execute(self, code: str, stdin: str = "") -> ExecutionResult:
        """
        Execute Python code in sandbox and return results.
        
        Args:
            code: Python code to execute
            stdin: Input to provide to the program
            
        Returns:
            ExecutionResult with stdout, stderr, and status
        """
        # Never fall back to an unisolated host subprocess.
        if not shutil.which(self.config.BWRAP_EXECUTABLE) or not os.path.isfile(self.config.PYTHON_EXECUTABLE):
            return ExecutionResult(
                status="error", stdout="",
                stderr="Isolated sandbox unavailable; code execution is disabled.",
                exit_code=1, execution_time_ms=0,
            )
        validation_error = self._validate_code(code)
        if validation_error:
            return ExecutionResult(
                status="error",
                stdout="",
                stderr=validation_error,
                exit_code=1,
                execution_time_ms=0,
            )
        
        if len(stdin) > self.config.MAX_INPUT_SIZE:
            return ExecutionResult(status="error", stdout="", stderr="Input exceeds maximum size.", exit_code=1, execution_time_ms=0)
        wrapped_code = self._wrap_code(code)
        return self._execute_subprocess(wrapped_code, stdin)
    
    def evaluate(
        self,
        code: str,
        test_cases: list[dict],
        problem_title: str = "",
    ) -> EvaluationResult:
        """
        Execute code against test cases and evaluate results.
        
        Args:
            code: Python code to evaluate
            test_cases: List of {"input": str, "expected": str, "name": str}
            problem_title: Title for feedback context
            
        Returns:
            EvaluationResult with test results and feedback
        """
        test_results = []
        total_time = 0
        all_stdout = []
        all_stderr = []
        
        for test in test_cases:
            result = self.execute(code, test.get("input", ""))
            total_time += result.execution_time_ms
            
            expected = test.get("expected", "").strip()
            actual = result.stdout.strip()
            # Empty stdout must not turn a crashed or rejected program into a pass.
            passed = result.status == "success" and actual == expected
            
            test_results.append(TestResult(
                name=test.get("name", f"Test {len(test_results) + 1}"),
                passed=passed,
                expected=expected,
                actual=actual,
                error=result.stderr if result.status != "success" else None,
            ))
            
            if result.stdout:
                all_stdout.append(result.stdout)
            if result.stderr:
                all_stderr.append(result.stderr)
            
            # Stop on timeout
            if result.status == "timeout":
                break
        
        passed_count = sum(1 for t in test_results if t.passed)
        total_count = len(test_cases)
        
        # Determine overall status
        if all(t.passed for t in test_results) and len(test_results) == total_count:
            status = "passed"
        elif any(t.error and "timeout" in t.error.lower() for t in test_results):
            status = "timeout"
        elif any(t.error for t in test_results):
            status = "error"
        else:
            status = "failed"
        
        # Generate feedback
        feedback = self._generate_feedback(
            test_results, status, problem_title
        )
        
        return EvaluationResult(
            status=status,
            test_results=test_results,
            stdout="\n".join(all_stdout)[:self.config.MAX_OUTPUT_SIZE],
            stderr="\n".join(all_stderr)[:self.config.MAX_OUTPUT_SIZE],
            execution_time_ms=total_time,
            passed_count=passed_count,
            total_count=total_count,
            feedback=feedback,
        )
    
    def _validate_code(self, code: str) -> str | None:
        """
        Validate code for basic safety issues.
        
        Returns error message if invalid, None if valid.
        """
        # Friendly early rejection for common disallowed constructs. These
        # checks are not the security boundary; bubblewrap isolation is.
        dangerous_patterns = [
            ("import os", "Importing 'os' module is not allowed"),
            ("import sys", "Importing 'sys' module is not allowed"),
            ("import subprocess", "Importing 'subprocess' module is not allowed"),
            ("import socket", "Importing 'socket' module is not allowed"),
            ("import requests", "Importing 'requests' module is not allowed"),
            ("import urllib", "Importing 'urllib' module is not allowed"),
            ("__import__", "Using __import__ is not allowed"),
            ("open(", "File operations are not allowed"),
            ("exec(", "Using exec() is not allowed"),
            ("eval(", "Using eval() is not allowed"),
        ]
        
        for pattern, message in dangerous_patterns:
            if pattern in code:
                return f"Security Error: {message}"
        
        if len(code) > self.config.MAX_CODE_SIZE:
            return "Code exceeds maximum length of 50KB"
        
        return None
    
    def _wrap_code(self, code: str) -> str:
        """Wrap user code with safety measures."""
        # Remove dangerous builtins
        wrapper = f'''
import sys
import resource

# Apply limits only after entering the unprivileged user/PID namespaces.
_cpu = {self.config.TIMEOUT_SECONDS}
_mem = {self.config.MEMORY_LIMIT_MB} * 1024 * 1024
resource.setrlimit(resource.RLIMIT_CPU, (_cpu, _cpu + 1))
resource.setrlimit(resource.RLIMIT_AS, (_mem, _mem))
resource.setrlimit(resource.RLIMIT_FSIZE, ({self.config.MAX_OUTPUT_SIZE}, {self.config.MAX_OUTPUT_SIZE}))
resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))
resource.setrlimit(resource.RLIMIT_NPROC, (16, 16))
resource.setrlimit(resource.RLIMIT_CORE, (0, 0))

# Keep the normal Python runtime intact; isolation is enforced by the OS namespace.
sys.setrecursionlimit(500)

# User code
{code}
'''
        return wrapper
    
    def _execute_subprocess(self, code: str, stdin: str) -> ExecutionResult:
        """Execute in a networkless, minimal-filesystem bubblewrap namespace."""
        started = time.monotonic()

        cmd = [
            self.config.BWRAP_EXECUTABLE,
            "--die-with-parent", "--new-session", "--unshare-all",
            "--uid", "65534", "--gid", "65534",
            "--ro-bind", "/usr", "/usr",
            "--dev", "/dev", "--proc", "/proc", "--tmpfs", "/tmp",
            "--chdir", "/tmp", "--clearenv",
            "--setenv", "PATH", "/usr/bin",
            "--setenv", "HOME", "/tmp",
            "--setenv", "PYTHONDONTWRITEBYTECODE", "1",
        ]
        for path in ("/lib", "/lib64"):
            if os.path.exists(path):
                cmd.extend(["--ro-bind", path, path])
        # Some containers install Python and the standard library in /usr/local.
        if os.path.exists("/usr/local"):
            cmd.extend(["--ro-bind", "/usr/local", "/usr/local"])
        cmd.extend(["--", self.config.PYTHON_EXECUTABLE, "-I", "-S", "-u", "-c", code])

        try:
            with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
                proc = subprocess.Popen(
                    cmd, stdin=subprocess.PIPE, stdout=out, stderr=err,
                    cwd="/", env={}, start_new_session=True,
                )
                try:
                    proc.communicate(input=stdin, timeout=self.config.TIMEOUT_SECONDS + 1)
                except subprocess.TimeoutExpired:
                    os.killpg(proc.pid, signal.SIGKILL)
                    proc.communicate()
                    return ExecutionResult(
                        status="timeout", stdout="",
                        stderr=f"Execution timed out after {self.config.TIMEOUT_SECONDS} seconds",
                        exit_code=-1, execution_time_ms=self.config.TIMEOUT_SECONDS * 1000,
                    )
                out.seek(0); err.seek(0)
                stdout = out.read(self.config.MAX_OUTPUT_SIZE + 1).decode("utf-8", "replace")
                stderr = err.read(self.config.MAX_OUTPUT_SIZE + 1).decode("utf-8", "replace")
                truncated = len(stdout) > self.config.MAX_OUTPUT_SIZE or len(stderr) > self.config.MAX_OUTPUT_SIZE
                stdout = stdout[:self.config.MAX_OUTPUT_SIZE]
                stderr = stderr[:self.config.MAX_OUTPUT_SIZE]
                if truncated:
                    stderr = (stderr + "\\n[output truncated]")[:self.config.MAX_OUTPUT_SIZE]
                if proc.returncode == 0:
                    status = "success"
                elif proc.returncode in (128 + signal.SIGXCPU, -signal.SIGXCPU):
                    status = "timeout"
                    stderr = f"CPU time limit exceeded ({self.config.TIMEOUT_SECONDS}s)"
                else:
                    status = "error" if "SyntaxError" in stderr else "runtime_error"
                return ExecutionResult(status, stdout, stderr, proc.returncode or 0,
                                       int((time.monotonic() - started) * 1000))
        except Exception as exc:
            return ExecutionResult("error", "", f"Isolated execution failed: {type(exc).__name__}", -1,
                                   int((time.monotonic() - started) * 1000))
    
    def _generate_feedback(
        self,
        test_results: list[TestResult],
        status: str,
        problem_title: str,
    ) -> str:
        """Generate helpful feedback based on test results."""
        if status == "passed":
            return "✅ All tests passed! Great job!"
        
        if status == "timeout":
            return (
                "⏱️ Your code took too long to run. "
                "Check for infinite loops or optimize your algorithm."
            )
        
        failed_tests = [t for t in test_results if not t.passed]
        
        if status == "error":
            first_error = next((t.error for t in test_results if t.error), None)
            if first_error:
                # Extract useful error message
                if "SyntaxError" in first_error:
                    return "❌ Syntax Error: Check your code for typos or missing punctuation."
                elif "NameError" in first_error:
                    return "❌ Name Error: You're using a variable or function that doesn't exist."
                elif "TypeError" in first_error:
                    return "❌ Type Error: You're using a value of the wrong type."
                elif "IndexError" in first_error:
                    return "❌ Index Error: You're trying to access an element outside the list bounds."
                else:
                    return f"❌ Runtime Error: {first_error[:200]}"
        
        # status == "failed"
        passed = sum(1 for t in test_results if t.passed)
        total = len(test_results)
        
        feedback_parts = [
            f"❌ {passed}/{total} tests passed.",
        ]
        
        # Show first failed test as hint
        if failed_tests:
            first_fail = failed_tests[0]
            feedback_parts.append(
                f"\nHint: For test '{first_fail.name}', "
                f"expected '{first_fail.expected}' but got '{first_fail.actual}'."
            )
        
        return " ".join(feedback_parts)
