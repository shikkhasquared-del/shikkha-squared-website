import { paymentReturn } from '../../../../lib/payment-callbacks';
export const dynamic='force-dynamic';
export async function POST(request:Request){return paymentReturn(request,'failed');}
