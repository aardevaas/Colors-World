import { ScaleLab } from '@/components/scale-lab/ScaleLab';
import { AccountStatus } from '@/components/auth/AccountStatus';

export default function ScaleLabPage() {
  return <ScaleLab accountSlot={<AccountStatus />} />;
}
