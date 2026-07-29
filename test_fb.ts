import { db } from './src/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

async function main() {
  const qTrans = query(collection(db, "transacciones"), where('Num', '==', 1));
  const snap = await getDocs(qTrans);
  console.log("Found:", snap.docs.length);
  snap.docs.forEach(d => console.log(d.id, "=>", d.data()));
  process.exit(0);
}
main();
