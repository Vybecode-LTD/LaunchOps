import { useState } from "react";
import { useNavigate } from "react-router";
import { errorMessage } from "@/lib/api/client";
import type { ProjectType } from "@/lib/api/types";
import { useCreateProject } from "@/lib/queries/hooks";
import { PROJECT_TYPE_LABELS, SWATCHES } from "@/lib/domain/projects";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { Field, FieldRow, FieldStack, Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Overlay";
import { Segmented } from "@/components/ui/Display";
import { SwatchPicker } from "@/components/project/SwatchPicker";
import { useToast } from "@/components/ui/toast";

const NAME_PLACEHOLDER: Record<ProjectType, string> = {
  product: "VybeCode DSP",
  service: "CloudOps Consulting",
  persona: "Tech Talk with Tina",
};

const DESCRIPTION_PLACEHOLDER: Record<ProjectType, string> = {
  product: "What it does, who it's for, and what makes it different.",
  service: "The service, the clients it serves, and why they choose it.",
  persona: "The niche, the audience, the format and the voice.",
};

export function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New project"
      description="Everything here becomes context for the project's AI operations. You can change it later."
      wide
    >
      {open && <NewProjectForm onDone={() => onOpenChange(false)} />}
    </Modal>
  );
}

function NewProjectForm({ onDone }: { onDone: () => void }) {
  const create = useCreateProject();
  const navigate = useNavigate();
  const toast = useToast();
  const [type, setType] = useState<ProjectType>("product");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [launchDate, setLaunchDate] = useState("");
  const [color, setColor] = useState<string>(SWATCHES[0].value);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      const project = await create.mutateAsync({
        name: name.trim(),
        tagline: tagline.trim(),
        url: url.trim(),
        description: description.trim(),
        color,
        project_type: type,
        launch_date: launchDate || null,
      });
      toast.show({ title: `${project.name} created` });
      onDone();
      navigate(routes.project(project.id));
    } catch (err) {
      setError(errorMessage(err));
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
        <div>
          <Segmented<ProjectType>
            label="Project type"
            value={type}
            onChange={setType}
            options={(Object.keys(PROJECT_TYPE_LABELS) as ProjectType[]).map((t) => ({ value: t, label: PROJECT_TYPE_LABELS[t] }))}
          />
        </div>
        <FieldRow>
          <Field label="Name">
            {(props) => (
              <Input {...props} value={name} onChange={(e) => setName(e.target.value)} placeholder={NAME_PLACEHOLDER[type]} autoFocus required />
            )}
          </Field>
          <Field label="Tagline" optional>
            {(props) => <Input {...props} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="One line" />}
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Website" optional hint="Used by press kit, press release and SEO operations.">
            {(props) => (
              <Input {...props} type="url" mono value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
            )}
          </Field>
          <Field label="Launch date" optional hint="Starts the T-minus clock on the portfolio.">
            {(props) => <Input {...props} type="date" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} />}
          </Field>
        </FieldRow>
        <Field
          label="Description"
          optional
          hint={`${description.trim().length} characters. 80 or more counts toward launch readiness.`}
        >
          {(props) => (
            <Textarea
              {...props}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={DESCRIPTION_PLACEHOLDER[type]}
              rows={4}
            />
          )}
        </Field>
        <Field label="Color">{(props) => <SwatchPicker id={props.id} value={color} onChange={setColor} />}</Field>
        {error && (
          <div role="alert" style={{ color: "var(--crit)", fontSize: "var(--text-13)" }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={create.isPending} disabled={!name.trim()}>
            Create project
          </Button>
        </div>
      </FieldStack>
    </form>
  );
}
