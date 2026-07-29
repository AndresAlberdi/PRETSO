const admin = require('firebase-admin');
const path = require('path');

process.env.FIRESTORE_EMULATOR_HOST = undefined;
admin.initializeApp({
  projectId: 'pretso-database'
});

const db = admin.firestore();

async function migrate() {
    console.log("Fetching companias...");
    const companiasSnap = await db.collection('companias').get();
    
    const siglaToIndex = {};
    companiasSnap.forEach(doc => {
        const data = doc.data();
        const sigla = data["Sigla Compañía"];
        const indicador = data["Indicador de registro"];
        if (sigla && indicador !== undefined && indicador !== null) {
            siglaToIndex[String(sigla).trim()] = String(indicador);
        }
    });

    console.log(`Found ${Object.keys(siglaToIndex).length} companias.`);

    const collectionsToMigrate = ['manejo_de_caja', 'salarios', 'indicadores'];
    
    for (const coll of collectionsToMigrate) {
        console.log(`Migrating ${coll}...`);
        const docs = await db.collection(coll).get();
        let batch = db.batch();
        let updates = 0;
        
        docs.forEach(doc => {
            const data = doc.data();
            const sigla = data["Sigla Compañía"];
            if (sigla && siglaToIndex[String(sigla).trim()]) {
                batch.update(doc.ref, { "Sigla Compañía": siglaToIndex[String(sigla).trim()] });
                updates++;
                if (updates > 0 && updates % 400 === 0) {
                    batch.commit();
                    batch = db.batch();
                }
            }
        });
        
        if (updates % 400 !== 0) {
            await batch.commit();
        }
        console.log(`Updated ${updates} records in ${coll}`);
    }

    console.log("Migrating corpus_christi...");
    const corpusDocs = await db.collection('corpus_christi').get();
    let batch = db.batch();
    let updates = 0;
    
    corpusDocs.forEach(doc => {
        const data = doc.data();
        let needsUpdate = false;
        const updateData = {};
        
        for (const [k, v] of Object.entries(data)) {
            if (k.startsWith("Compañía") || k.startsWith("Cmp")) {
                if (v && siglaToIndex[String(v).trim()]) {
                    updateData[k] = siglaToIndex[String(v).trim()];
                    needsUpdate = true;
                }
            }
        }
        
        if (needsUpdate) {
            batch.update(doc.ref, updateData);
            updates++;
            if (updates > 0 && updates % 400 === 0) {
                batch.commit();
                batch = db.batch();
            }
        }
    });
    
    if (updates % 400 !== 0) {
        await batch.commit();
    }
    console.log(`Updated ${updates} records in corpus_christi`);
}

migrate().then(() => {
    console.log("Migration finished.");
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
