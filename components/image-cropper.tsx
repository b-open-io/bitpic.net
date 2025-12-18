"use client";

import { useCallback, useState } from "react";
import type { Area, Point } from "react-easy-crop";
import Cropper from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImage: string) => void;
  onCancel?: () => void;
}

export function ImageCropper({
  image,
  onCropComplete,
  onCancel,
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropChange = (newCrop: Point) => {
    setCrop(newCrop);
  };

  const onZoomChange = (newZoom: number) => {
    setZoom(newZoom);
  };

  const onCropAreaChange = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    [],
  );

  const handleCropComplete = useCallback(async () => {
    if (!croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const croppedImage = await getCroppedImage(image, croppedAreaPixels);
      onCropComplete(croppedImage);
    } catch (error) {
      console.error("Error cropping image:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [croppedAreaPixels, image, onCropComplete]);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="relative h-96 bg-muted rounded-lg overflow-hidden">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropAreaChange}
        />
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">Zoom</span>
        <Slider
          value={[zoom]}
          onValueChange={([value]) => setZoom(value)}
          min={1}
          max={3}
          step={0.1}
          className="w-full"
          aria-label="Zoom level"
        />
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="button"
          onClick={handleCropComplete}
          disabled={isProcessing || !croppedAreaPixels}
        >
          {isProcessing ? "Processing..." : "Crop Image"}
        </Button>
      </div>
    </div>
  );
}

const MAX_SIZE_BYTES = 1024 * 1024; // 1MB limit
const MAX_DIMENSION = 512; // Max width/height for avatar

/**
 * Crop and optimize image to fit under size limit
 */
async function getCroppedImage(
  imageSrc: string,
  pixelCrop: Area,
): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Calculate output size - scale down if needed
  let outputWidth = pixelCrop.width;
  let outputHeight = pixelCrop.height;

  if (outputWidth > MAX_DIMENSION || outputHeight > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(outputWidth, outputHeight);
    outputWidth = Math.round(outputWidth * scale);
    outputHeight = Math.round(outputHeight * scale);
  }

  canvas.width = outputWidth;
  canvas.height = outputHeight;

  // Use better image smoothing for downscaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Draw the cropped and scaled image
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  // Try to get under size limit by reducing quality
  return compressToFit(canvas);
}

/**
 * Compress image to fit under MAX_SIZE_BYTES
 */
async function compressToFit(canvas: HTMLCanvasElement): Promise<string> {
  // Try JPEG first (usually smaller)
  const formats: Array<{ type: string; qualities: number[] }> = [
    { type: "image/jpeg", qualities: [0.92, 0.85, 0.75, 0.65, 0.5, 0.4] },
    { type: "image/png", qualities: [1] }, // PNG doesn't have quality, but try as fallback
  ];

  for (const format of formats) {
    for (const quality of format.qualities) {
      const result = await canvasToDataURL(canvas, format.type, quality);
      const sizeBytes = getBase64Size(result);

      if (sizeBytes <= MAX_SIZE_BYTES) {
        console.log(
          `Image compressed to ${(sizeBytes / 1024).toFixed(1)}KB with ${format.type} @ ${quality}`,
        );
        return result;
      }
    }
  }

  // If still too large, scale down the canvas and try again
  const smallerCanvas = document.createElement("canvas");
  const ctx = smallerCanvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  smallerCanvas.width = Math.round(canvas.width * 0.75);
  smallerCanvas.height = Math.round(canvas.height * 0.75);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);

  // Recursive call with smaller canvas
  return compressToFit(smallerCanvas);
}

function canvasToDataURL(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create blob"));
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      },
      type,
      quality,
    );
  });
}

function getBase64Size(base64: string): number {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
  return Math.ceil((base64Data.length * 3) / 4);
}

/**
 * Load image from source
 */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
}
