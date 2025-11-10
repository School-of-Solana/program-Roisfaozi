import { AppHero } from '@/components/app-hero';
import { CreateEscrow } from '@/components/escrow/CreateEscrow';
import { EscrowList } from '@/components/escrow/EscrowList';

export default function Home() {
  return (
    <div>
      <AppHero
        title="Escrow dApp"
        subtitle="Create a new escrow or manage existing ones."
      />
      <div className="max-w-xl mx-auto py-6 sm:px-6 lg:px-8 space-y-8">
        <CreateEscrow />
        <EscrowList />
      </div>
    </div>
  );
}
