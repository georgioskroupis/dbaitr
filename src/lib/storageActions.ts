
"use server";

import { storage } from '@/lib/firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateUserVerificationStatus } from './firestoreActions';

export async function uploadIdDocument(userId: string, formData: FormData): Promise<{ url?: string; error?: string }> {
  const file = formData.get('idDocument') as File;

  if (!file) {
    return { error: 'No file was selected for upload. Please choose a file and try again.' };
  }

  if (file.size > 5 * 1024 * 1024) { // Max 5MB
    return { error: 'The selected file exceeds the maximum size limit of 5MB. Please choose a smaller file.' };
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Invalid file type. Only JPG, PNG, or PDF files are accepted. Please select a file with a supported format.' };
  }

  try {
    const storageRef = ref(storage, `id_documents/${userId}/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    // Update user profile with verification status and document URL
    await updateUserVerificationStatus(userId, downloadURL);

    return { url: downloadURL };
  } catch (error: any) {
    console.error(`Detailed error during ID document upload on server for user ${userId}:`, error);
    // Provide a more specific error message if available, otherwise a generic one.
    const errorMessage = error.message 
      ? `Server-side upload failed due to: ${error.message}` 
      : 'An unexpected server-side error occurred while attempting to upload the ID document. Please try again later or contact support if the issue persists.';
    return { error: errorMessage };
  }
}

