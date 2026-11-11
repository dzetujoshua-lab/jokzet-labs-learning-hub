import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import DeptGlyph from '@/components/dashboard/DeptGlyph';
import { metaFor } from '@/lib/programme';
import { FileText, Camera, ExternalLink } from 'lucide-react';

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|heic)$/i;

const isImage = (evidence) =>
  (!!evidence.file_uri && ['Screenshot', 'Photo'].includes(evidence.type)) ||
  IMAGE_EXT.test(evidence.link_url || '') ||
  IMAGE_EXT.test(evidence.file_name || '');

export default function EvidenceMedia({ evidence }) {
  const [url, setUrl] = useState(evidence.link_url || null);
  const meta = metaFor(evidence.department_code);

  useEffect(() => {
    let active = true;
    if (!evidence.file_uri) return () => { active = false; };
    base44.integrations.Core.CreateFileSignedUrl({ file_uri: evidence.file_uri })
      .then((res) => {
        if (active) setUrl(res.signed_url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [evidence.file_uri]);

  if (url && isImage(evidence)) {
    return (
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary">
        <Image src={url} alt={evidence.title} className="h-full w-full" fittingType="fill" />
      </div>
    );
  }

  const Icon = evidence.type === 'Photo' || evidence.type === 'Video' ? Camera : FileText;

  return (
    <div className="relative flex aspect-[16/10] w-full flex-col justify-between bg-secondary/60 p-4">
      <Icon className="h-5 w-5" strokeWidth={1.5} style={{ color: meta.color }} />
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {evidence.file_name || evidence.link_url || evidence.type}
        </span>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <DeptGlyph icon={meta.icon} className="h-3.5 w-3.5" />
        )}
      </div>
    </div>
  );
}