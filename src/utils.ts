export const cleanFirebaseData = (doc: any) => {
  const d = { id: doc.id, ...doc.data() };
  for (let key in d) {
    if (typeof d[key] === 'string' && d[key].trim().toLowerCase() === 'x') {
      d[key] = '';
    }
  }
  return d;
};
