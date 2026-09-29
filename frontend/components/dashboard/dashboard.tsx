import { PlusIcon, ArrowIcon, PacksIcon } from "@/components/icons/brand";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/status";
import type { PackSummary } from "@/types";
export function Dashboard({
  packs,
  onOpen,
  onCreate,
  onDemo,
  title,
}: {
  packs: PackSummary[];
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDemo: () => void;
  title: string;
}) {
  return (
    <div className="page">
      <div className="row spread">
        <div>
          <div className="kicker">Workspace · Teacher Studio</div>
          <h1>
            {title === "Dashboard"
              ? "Your teaching, connected."
              : "Learning Packs"}
          </h1>
          <p className="muted">
            Turn trusted knowledge into learning you can stand behind.
          </p>
        </div>
        <Button variant="default" onClick={onCreate}>
          <PlusIcon size={16} />
          Create Learning Pack
        </Button>
      </div>
      <div className="stats">
        {[
          ["Learning packs", packs.length],
          ["Source boundary", "Enforced"],
          ["Publication", "Teacher-led"],
          ["Version history", "Preserved"],
        ].map(([l, v]) => (
          <div className="stat" key={l}>
            <small>{l}</small>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      {!packs.length ? (
        <Empty title="Start with the sources you already teach from">
          <p>
            Upload teaching material, set objectives, and review an
            evidence-linked pack. Nothing reaches students until you approve it.
          </p>
          <div className="row">
            <Button variant="default" onClick={onCreate}>
              Create your first pack <ArrowIcon size={14} />
            </Button>
            <Button onClick={onDemo}>Load labeled Newton demo</Button>
          </div>
        </Empty>
      ) : (
        <>
          <div className="row spread">
            <h4>Recent learning packs</h4>
            <Button variant="ghost" onClick={onDemo}>
              Load Newton demo
            </Button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pack</th>
                  <th>Subject / level</th>
                  <th>Exam</th>
                  <th>Version</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {packs.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        className="table-link"
                        onClick={() => onOpen(p.id)}
                      >
                        {p.title}
                      </button>
                    </td>
                    <td>
                      {p.subject}
                      <br />
                      <small>{p.level}</small>
                    </td>
                    <td>{p.exam}</td>
                    <td>v{p.revision}</td>
                    <td>{new Date(p.created_at).toLocaleDateString()}</td>
                    <td>
                      <Button variant="ghost" onClick={() => onOpen(p.id)}>
                        Open <ArrowIcon size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="rule" style={{ marginTop: 40 }}>
        <PacksIcon size={20} />
        <h4 style={{ marginTop: 12 }}>Generation with control</h4>
        <p className="muted">
          Source → Evidence → Objectives → Learning pack → Validation → Teacher
          approval
        </p>
      </div>
    </div>
  );
}
