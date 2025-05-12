"use server";

import { storage } from '@/lib/firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateUserVerificationStatus } from './firestoreActions';

export async function uploadIdDocument(userId: string, formData: FormData): Promise<{ url?: string; error?: string }> {
  const file = formData.get('idDocument') as File;

  if (!file) {
    return { error: 'No file selected.' };
  }

  if (file.size > 5 * 1024 * 1024) { // Max 5MB
    return { error: 'File size exceeds 5MB limit.' };
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Invalid file type. Only JPG, PNG, or PDF are allowed.' };
  }

  try {
    const storageRef = ref(storage, `id_documents/${userId}/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    // Update user profile with verification status and document URL
    await updateUserVerificationStatus(userId, downloadURL);

    return { url: downloadURL };
  } catch (error: any) {
    console.error('Error uploading ID document:', error);
    return { error: error.message || 'Failed to upload ID document.' };
  }
}
