from typing import Literal
from pydantic import BaseModel, Field, model_validator


class FlowNode(BaseModel):
    id: str = Field(min_length=1, max_length=60)
    label: str = Field(min_length=1, max_length=200)
    type: Literal["concept", "fact", "process", "decision"] = "concept"


class FlowEdge(BaseModel):
    source: str = Field(min_length=1, max_length=60)
    target: str = Field(min_length=1, max_length=60)
    relationship: str = Field(default="leads to", max_length=200)


class Constraints(BaseModel):
    language: str = Field(default="English", min_length=1, max_length=60)
    max_words: int = Field(default=300, ge=40, le=1000)
    answer_reveal: bool = False
    vocabulary: str = Field(default="Student-friendly", max_length=300)


class PackInput(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    subject: str = Field(default="Physics", max_length=100)
    level: str = Field(default="Class 11", max_length=100)
    exam: str = Field(default="CBSE / JEE", max_length=100)
    summary: str = Field(default="", max_length=2000)
    objectives: list[str] = Field(min_length=2, max_length=8)
    constraints: Constraints = Field(default_factory=Constraints)
    classroom_id: str | None = Field(default=None)

    @model_validator(mode="after")
    def distinct(self):
        self.objectives = [s.strip() for s in self.objectives]
        if any(not s or len(s) > 500 for s in self.objectives) or len(
            set(self.objectives)
        ) != len(self.objectives):
            raise ValueError(
                "Provide distinct nonblank objectives, at most 500 characters each"
            )
        return self


class TextSource(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=30, max_length=100000)
    source_id: str | None = None


class Payload(BaseModel):
    title: str = Field(min_length=1, max_length=250)
    body: str = Field(min_length=1, max_length=15000)
    options: list[str] = Field(default_factory=list, max_length=4)
    answer: int | None = Field(default=None, ge=0, le=3)
    solution: str = Field(default="", max_length=5000)
    difficulty: Literal["Easy", "Medium", "Advanced"] = "Easy"
    bloom: Literal[
        "Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"
    ] = "Understand"
    evidence_ids: list[str] = Field(min_length=1, max_length=20)
    claims: list[str] = Field(default_factory=list, max_length=30)
    flowchart: dict | None = Field(default=None, description="Optional structured concept-flow nodes and edges")


class Generated(Payload):
    slot: str
    objective_id: str


class EditInput(BaseModel):
    expected_version: int
    payload: Payload


class ReviewInput(BaseModel):
    expected_version: int | None = None
    expected_revision: int | None = None
    note: str = Field(min_length=10, max_length=2000)


class VideoInput(BaseModel):
    pack_id: str
    avatar_id: str | None = None


class Choice(BaseModel):
    choice: int = Field(ge=0, le=3)


class CustomResourceInput(BaseModel):
    url: str = Field(min_length=12, max_length=500)
    title: str | None = Field(default=None, max_length=250)


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    role: Literal["teacher", "student"] | None = None
    institution_type: Literal["school", "college", "independent"] | None = None
    institution_name: str | None = Field(default=None, max_length=200)
    grade_level: str | None = Field(default=None, max_length=100)
    avatar_url: str | None = Field(default=None, max_length=500)
    onboarding_completed: bool | None = None


class ObjectiveEdit(BaseModel):
    description: str = Field(min_length=5, max_length=500)
