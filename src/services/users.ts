import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';

export interface UserData {
  email: string;
  displayName: string;
  role: 'администратор' | 'руководитель' | 'печатник' | 'резчик' | 'менеджер' | 'дизайнер';
  createdAt: number;
}

// Получение данных пользователя из Firestore
export const getUserData = async (uid: string): Promise<UserData | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    
    if (userDoc.exists()) {
      return userDoc.data() as UserData;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

// Создание нового пользователя в Firestore (вызывается администратором)
export const createUserInFirestore = async (uid: string, userData: UserData): Promise<void> => {
  try {
    await setDoc(doc(db, 'users', uid), userData);
  } catch (error) {
    console.error('Error creating user in Firestore:', error);
    throw error;
  }
};

/** Один запрос users по email: и наличие, и роль. */
export const getUserByEmail = async (email: string): Promise<UserData | null> => {
  try {
    const usersQuery = query(collection(db, 'users'), where('email', '==', email));
    const querySnapshot = await getDocs(usersQuery);
    if (querySnapshot.empty) return null;
    return querySnapshot.docs[0].data() as UserData;
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
};

// Проверка существования пользователя в Firestore
export const checkUserExists = async (email: string): Promise<boolean> => {
  const user = await getUserByEmail(email);
  return user !== null;
};

// Получение роли пользователя по email
export const getUserRole = async (email: string): Promise<string | null> => {
  const user = await getUserByEmail(email);
  return user?.role ?? null;
};

// Обновление данных пользователя
export const updateUserData = async (uid: string, data: Partial<UserData>): Promise<void> => {
  try {
    await setDoc(doc(db, 'users', uid), data, { merge: true });
  } catch (error) {
    console.error('Error updating user data:', error);
    throw error;
  }
}; 