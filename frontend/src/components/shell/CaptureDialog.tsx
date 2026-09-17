import { useState } from "react";
import { useNavigate } from "react-router";
import { errorMessage } from "@/lib/api/client";
import { useCreateCapture, useProjects } from "@/lib/queries/hooks";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { Field, FieldStack, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Overlay";
import { Notice } from "@/components/ui/Display";
import { useToast } from "@/components/ui/toast";

export function CaptureDialog({
  open,
  onOpenChange,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Capture an idea"
      description="Save a one-line idea against a project. Later, turn it into an operation from Library → Ideas."
    >
      {open && <CaptureForm defaultProjectId={defaultProjectId} onDone={() => onOpenChange(false)} />}
    </Modal>
  );
}

function CaptureForm({ defaultProjectId, onDone }: { defaultProjectId?: string; onDone: () => void }) {
  const projects = useProjects();
  const create = useCreateCapture();
  const toast = useToast();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const selected = projectId || projects.data?.[0]?.id || "";

  if (projects.isSuccess && projects.data.length === 0) {
    return <Notice>Create a project first — every idea belongs to a project.</Notice>;
  }

  const submit = async () => {
    if (!text.trim() || !selected) return;
    try {
      await create.mutateAsync({ text: text.trim(), productId: selected });
      toast.show({
        title: "Idea captured",
        action: { label: "View ideas", onClick: () => navigate(`${routes.library}?tab=ideas`) },
      });
      onDone();
    } catch (err) {
      toast.show({ title: "Idea not saved", description: errorMessage(err), tone: "crit" });
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <FieldStack>
        <Field label="Idea">
          {(props) => (
            <Textarea
              {...props}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Reddit post for the DSP launch aimed at Ableton users"
              rows={3}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
          )}
        </Field>
        <Field label="Project">
          {(props) => (
            <Select {...props} value={selected} onChange={(e) => setProjectId(e.target.value)}>
              {(projects.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={create.isPending} disabled={!text.trim() || !selected}>
            Save idea
          </Button>
        </div>
      </FieldStack>
    </form>
  );
}
