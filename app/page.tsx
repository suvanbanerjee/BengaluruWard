import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('@/components/map'), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto p-4">
        <h1 className="text-4xl font-bold mb-8 text-center">St. Broseph Foundation</h1>
        <MapComponent />
      </main>
    </div>
  );
}