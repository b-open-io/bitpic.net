"use client";

import { UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  const [isDragging, setIsDragging] = useState(false);
  const router = useRouter();

  return (
    <section className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <div className="flex flex-col items-center text-center space-y-8">
        {/* Badge */}
        <Badge
          variant="outline"
          className="border-primary/20 text-primary hover:bg-primary/10"
        >
          v2.0 Beta
        </Badge>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tight max-w-4xl">
          Your own avatar on bitcoin,{" "}
          <span className="text-muted-foreground">forever.</span>
        </h1>

        {/* Upload CTA */}
        <div
          className={`w-full max-w-xl mt-8 border-2 border-dashed rounded-sm p-12 transition-all cursor-pointer ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary hover:bg-accent/50"
          }`}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            router.push("/upload");
          }}
          onClick={() => {
            router.push("/upload");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              router.push("/upload");
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Upload avatar image"
        >
          <div className="flex flex-col items-center gap-4">
            <UploadCloud
              className={`h-12 w-12 transition-colors ${
                isDragging ? "text-primary" : "text-muted-foreground"
              }`}
            />
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Drop your image here or click to upload
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, GIF up to 1MB
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
