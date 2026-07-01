/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TeamTalkImageViewer.tsx — Thumbnail + full-screen lightbox for image messages
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';

interface ImageViewerProps {
  url: string;
  width?: number;
  height?: number;
}

export default function TeamTalkImageViewer({ url, width, height }: ImageViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const aspect = width && height ? width / height : undefined;

  return (
    <>
      <img
        src={url}
        alt="Shared photo"
        onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
        style={aspect ? { aspectRatio: `${aspect}` } : undefined}
        className="max-w-[240px] max-h-[280px] w-full rounded-xl object-cover cursor-zoom-in"
      />

      {expanded && (
        <div
          className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-4"
          onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={url}
            alt="Shared photo"
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
