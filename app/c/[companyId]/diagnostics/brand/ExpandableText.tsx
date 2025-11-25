'use client';

import { useState } from 'react';

interface ExpandableTextProps {
  text: string;
  maxLength?: number;
}

export function ExpandableText({ text, maxLength = 200 }: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // If text is shorter than maxLength, just display it
  if (text.length <= maxLength) {
    return <p className="text-sm text-slate-300 leading-relaxed">{text}</p>;
  }

  const displayText = isExpanded ? text : `${text.slice(0, maxLength)}...`;

  return (
    <div>
      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
        {displayText}
      </p>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
      >
        {isExpanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
}
