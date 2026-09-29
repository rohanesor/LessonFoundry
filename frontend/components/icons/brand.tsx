/**
 * LessonFoundry brand assets.
 *
 * Icons are rendered by LFIcon (24×24 grid, 1.75 stroke, square caps, mitred joins).
 * Logos are the official SVGs from the design handoff, loaded from /public/logo.
 */
import type { SVGProps } from "react";
import { LFIcon, type LFIconName } from "./LFIcon";

type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & { size?: number };

export interface BrandAssetProps {
  height?: number;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  variant?: "color" | "ink" | "inverse" | "white";
}

/** Official LessonFoundry Lockup (Square Mark + Wordmark). */
export function LessonFoundryLogo({
  height = 20,
  variant = "color",
  className = "brand-logo",
  style,
}: BrandAssetProps) {
  const src =
    variant === "inverse"
      ? "/logo/lockup-inverse.svg"
      : variant === "ink"
      ? "/logo/lockup-ink.svg"
      : "/logo/lockup-color.svg";
  return (
    <img
      src={src}
      alt="LessonFoundry"
      height={height}
      className={className}
      style={{
        height: `${height}px`,
        width: "auto",
        display: "block",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

/** Official LessonFoundry Mark (Square mould + cast). */
export function LessonFoundryMark({
  size = 22,
  variant = "color",
  className = "brand-mark-img",
  style,
}: BrandAssetProps) {
  const src =
    variant === "white"
      ? "/logo/mark-white.svg"
      : variant === "inverse"
      ? "/logo/mark-inverse.svg"
      : variant === "ink"
      ? "/logo/mark-ink.svg"
      : "/logo/mark-color.svg";
  return (
    <img
      src={src}
      alt="LessonFoundry"
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: "block",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

/** LessonFoundry text-only Wordmark (Archivo font matching the brand design). */
export function LessonFoundryWordmark({
  height = 20,
  className = "brand-wordmark-text",
  style,
}: BrandAssetProps) {
  return (
    <svg
      viewBox="0 0 190 32"
      height={height}
      aria-label="LessonFoundry"
      className={className}
      style={{
        height: `${height}px`,
        width: "auto",
        display: "block",
        flexShrink: 0,
        ...style,
      }}
    >
      <text
        x="0"
        y="24"
        fontFamily="Archivo, system-ui, sans-serif"
        fontSize="26"
        letterSpacing="-0.65"
        fill="#191f2b"
      >
        <tspan fontWeight="500">Lesson</tspan>
        <tspan fontWeight="800">Foundry</tspan>
      </text>
    </svg>
  );
}

/** Aliases for backward compatibility */
export const LFWordmark = LessonFoundryLogo;
export const LFMark = LessonFoundryMark;

/** Raw icon component. Prefer the named exports below. */
export { LFIcon, type LFIconName };

function named(name: LFIconName) {
  return function NamedIcon(p: IconProps) {
    const { size, ...rest } = p;
    return <LFIcon name={name as LFIconName} size={size} {...rest} />;
  };
}

/* ─── Named icon exports for the existing component surface ────────────── */

export const SourceIcon = named("source");
export const EvidenceIcon = named("evidence");
export const ObjectiveIcon = named("objective");
export const GenerationIcon = named("generate");
export const ValidationIcon = named("validation");
export const ApprovalIcon = named("approval");
export const VersionIcon = named("version");
export const StudentIcon = named("student");
export const AITeacherIcon = named("aiTeacher");
export const ResourcesIcon = named("resources");
export const DashboardIcon = named("dashboard");
export const PacksIcon = named("packs");
export const OverviewIcon = named("overview");
export const ExplanationIcon = named("explanation");
export const AssessmentIcon = named("assessment");
export const QuizIcon = named("quiz");
export const AnswerKeyIcon = named("answerKey");
export const ExamFocusIcon = named("exam");
export const SettingsIcon = named("settings");
export const PassIcon = named("check");
export const WarningIcon = named("warning");
export const FailIcon = named("fail");
export const DraftIcon = named("draft");
export const LockedIcon = named("lock");
export const QueuedIcon = named("queued");
export const RunningIcon = named("running");
export const RegenerateIcon = named("regenerate");
export const SaveIcon = named("edited");
export const PlayIcon = named("play");
export const CloseIcon = named("close");
export const UploadIcon = named("arrowRight"); /* handoff has no upload; arrow used for action */
export const DownloadIcon = named("arrowRight");
export const PlusIcon = named("plus");
export const ArrowIcon = named("arrowRight");
export const MenuIcon = named("overview"); /* proxy until menu icon added */
