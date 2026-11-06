import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { addDoc, collection, getDocs, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from '../../../../services/firebase';
import { RotationFormImport } from '../../../../shared/lib/rotation/parseKnivesExcel';

const IMPORT_BATCH_LIMIT = 450;

const formMatchKey = (form: object) => {
    const value = form as Record<string, unknown>;
    return [
        Number(value.width),
        Number(value.height),
        Number(value.columns),
        Number(value.rows),
        String(value.number ?? '').trim(),
    ].join('|');
};

export interface ImportFormsResult {
    created: number;
    updated: number;
    rotationForms: Array<{ id: string } & Record<string, unknown>>;
}

// Асинхронное действие для получения форм
export const fetchForms = createAsyncThunk(
    'forms/fetchForms',
    async () => {
        const querySnapshot = await getDocs(collection(db, 'Forms'));
        const forms = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        }));
        return forms;
    }
);

// Асинхронное действие для добавления формы
export const addForm = createAsyncThunk(
    'forms/addForm',
    async (form: any) => {
        const docRef = await addDoc(collection(db, 'Forms'), form);
        return {
            id: docRef.id,
            ...form
        };
    }
);

// Асинхронное действие для обновления формы
export const updateForm = createAsyncThunk(
    'forms/updateForm',
    async ({ id, updatedData }: { id: string, updatedData: any }) => {
        const formRef = doc(db, 'Forms', id);
        await updateDoc(formRef, updatedData);
        return {
            id,
            ...updatedData
        };
    }
);

// Импорт форм из Excel: совпадение по размеру, ручьям, рядам и номеру обновляет документ
export const importForms = createAsyncThunk(
    'forms/importForms',
    async (forms: RotationFormImport[]): Promise<ImportFormsResult> => {
        const snapshot = await getDocs(collection(db, 'Forms'));
        const existing = snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Record<string, unknown>),
        }));

        const idByKey = new Map<string, string>();
        existing.forEach((item) => {
            idByKey.set(formMatchKey(item), item.id);
        });

        const deduped: RotationFormImport[] = [];
        const dedupeIndex = new Map<string, number>();
        forms.forEach((form) => {
            const key = formMatchKey(form);
            const index = dedupeIndex.get(key);
            if (index === undefined) {
                dedupeIndex.set(key, deduped.length);
                deduped.push(form);
            } else {
                deduped[index] = form;
            }
        });

        let batch = writeBatch(db);
        let ops = 0;
        let created = 0;
        let updated = 0;
        const written: { id: string; data: Record<string, unknown> }[] = [];

        const commit = async () => {
            if (ops === 0) return;
            await batch.commit();
            batch = writeBatch(db);
            ops = 0;
        };

        for (const form of deduped) {
            const key = formMatchKey(form);
            const existingId = idByKey.get(key);
            if (existingId) {
                const ref = doc(db, 'Forms', existingId);
                batch.update(ref, { ...form });
                written.push({ id: existingId, data: { ...form } });
                updated += 1;
            } else {
                const ref = doc(collection(db, 'Forms'));
                const data = { ...form, createdAt: new Date().toISOString() };
                batch.set(ref, data);
                idByKey.set(key, ref.id);
                written.push({ id: ref.id, data });
                created += 1;
            }
            ops += 1;
            if (ops >= IMPORT_BATCH_LIMIT) await commit();
        }
        await commit();

        const byId = new Map(existing.map((item) => [item.id, item]));
        written.forEach(({ id, data }) => {
            const prev = byId.get(id) ?? {};
            byId.set(id, { ...prev, ...data, id });
        });

        return {
            created,
            updated,
            rotationForms: Array.from(byId.values()),
        };
    }
);

const RotationFormsSlice = createSlice({
    name: 'RotationFormsSlice',
    initialState: {
        rotationForms: [],
        loading: false,
        error: null
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            // Обработка fetchForms
            .addCase(fetchForms.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchForms.fulfilled, (state, action) => {
                state.loading = false;
                state.rotationForms = action.payload;
            })
            .addCase(fetchForms.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Произошла ошибка при загрузке форм';
            })
            // Обработка addForm
            .addCase(addForm.fulfilled, (state, action) => {
                state.rotationForms.push(action.payload);
            })
            // Обработка updateForm
            .addCase(updateForm.fulfilled, (state, action) => {
                const index = state.rotationForms.findIndex((form: any) => form.id === action.payload.id);
                if (index !== -1) {
                    state.rotationForms[index] = {
                        ...state.rotationForms[index],
                        ...action.payload
                    };
                }
            })
            .addCase(importForms.fulfilled, (state, action) => {
                state.rotationForms = action.payload.rotationForms as typeof state.rotationForms;
                state.error = null;
            });
    }
});

export default RotationFormsSlice.reducer;
