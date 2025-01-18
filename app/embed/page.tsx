import dynamic from 'next/dynamic';

const MapEmbed = dynamic(() => import('@/components/mapembed'), {
  ssr: false,
});

export default function Embed() {
  return (
        <MapEmbed />
  );
}