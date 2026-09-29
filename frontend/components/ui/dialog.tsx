"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { CloseIcon } from "@/components/icons/brand";
export function Panel({
  open,
  onClose,
  title,
  description,
  children,
  drawer = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: React.ReactNode;
  drawer?: boolean;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className={drawer ? "drawer" : "modal"}>
          <div className="panel-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close className="btn btn-ghost" aria-label="Close dialog">
              <CloseIcon size={20} />
            </Dialog.Close>
          </div>
          <div className="panel-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
