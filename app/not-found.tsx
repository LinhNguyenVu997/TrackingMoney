import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="container mx-auto p-6 max-w-2xl">
      <Card className="p-12 text-center space-y-4">
        <h1 className="text-6xl font-bold tracking-tight">404</h1>
        <p className="text-muted-foreground">The page you were looking for doesn&apos;t exist.</p>
        <Link href="/">
          <Button>Back to Trending</Button>
        </Link>
      </Card>
    </main>
  );
}
