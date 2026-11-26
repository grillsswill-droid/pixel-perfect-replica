import { ImagePlus, Upload, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { foodImage } from "@/lib/food-images";
import { GALLERY_IMAGE_ACCEPT, validateGalleryImage } from "@/lib/gallery-image";
import { cn } from "@/lib/utils";

export function GalleryImagePicker({
  file,
  url,
  disabled,
  onSelect,
  onRemove,
}: {
  file: File | null;
  url: string;
  disabled: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const helpId = useId();
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  function select(files: FileList | null) {
    if (disabled || !files?.length) return;
    if (files.length > 1) {
      setError("Choose one photo for each gallery post.");
      return;
    }
    const nextFile = files[0]!;
    try {
      validateGalleryImage(nextFile);
      setError("");
      onSelect(nextFile);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Choose another photo.");
    }
  }

  const imageUrl = file ? preview : foodImage(url);
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">Photo</p>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          select(event.dataTransfer.files);
        }}
        className={cn(
          "overflow-hidden rounded-2xl",
          dragging && "ring-2 ring-primary ring-offset-2",
        )}
      >
        {imageUrl ? (
          <div className="relative bg-card">
            <img
              src={imageUrl}
              alt="Photo preview"
              className="aspect-[4/3] w-full object-contain"
            />
            <Button
              type="button"
              variant="charcoal"
              size="icon"
              disabled={disabled}
              aria-label="Remove photo"
              className="absolute right-3 top-3 h-11 w-11 sm:h-11 sm:w-11"
              onClick={() => {
                setError("");
                onRemove();
              }}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            aria-describedby={helpId}
            onClick={() => input.current?.click()}
            className="flex min-h-48 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-input bg-card px-5 py-7 text-center transition-colors hover:border-primary hover:bg-accent disabled:cursor-wait disabled:opacity-50"
          >
            <ImagePlus className="h-9 w-9 text-primary" aria-hidden="true" />
            <span className="text-base font-bold">Upload from computer</span>
            <span className="text-sm text-muted-foreground">or drag a photo here</span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        aria-label="Choose a gallery photo"
        accept={GALLERY_IMAGE_ACCEPT}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          select(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      {imageUrl ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="min-w-0 break-words text-xs text-muted-foreground">
            {file ? file.name : "Current photo"}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => input.current?.click()}
          >
            <Upload aria-hidden="true" /> Change photo
          </Button>
        </div>
      ) : null}
      <p id={helpId} className="mt-2 text-xs leading-relaxed text-muted-foreground">
        JPEG, PNG or WebP, up to 20 MB. Large photos are resized automatically when you publish.
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
