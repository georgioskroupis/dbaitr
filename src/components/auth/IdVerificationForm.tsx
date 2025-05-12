
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { uploadIdDocument } from "@/lib/storageActions";

const formSchema = z.object({
  idDocument: z
    .custom<FileList>((val) => val instanceof FileList && val.length > 0, "Please select a file.")
    .refine(
      (files) => files?.[0]?.size <= 5 * 1024 * 1024, // 5MB
      `Max file size is 5MB.`
    )
    .refine(
      (files) => ["image/jpeg", "image/png", "application/pdf"].includes(files?.[0]?.type),
      "Only .jpg, .png, or .pdf files are accepted."
    ),
});

type IdVerificationFormValues = z.infer<typeof formSchema>;

export function IdVerificationForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, userProfile, loading: authLoading, kycVerified } = useAuth(); // Changed isVerified to kycVerified
  const [loading, setLoading] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);

  const form = useForm<IdVerificationFormValues>({
    resolver: zodResolver(formSchema),
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      form.setValue("idDocument", event.target.files!, { shouldValidate: true });
    } else {
      setFileName(null);
      form.resetField("idDocument");
    }
  };

  async function onSubmit(values: IdVerificationFormValues) {
    if (!user) {
      toast({ title: "Error: Not Logged In", description: "You must be logged in to upload an ID document. Please sign in and try again.", variant: "destructive" });
      return;
    }
    setLoading(true);
    
    const formData = new FormData();
    formData.append('idDocument', values.idDocument[0]);

    const result = await uploadIdDocument(user.uid, formData);

    if (result.url) {
      toast({ title: "ID Document Uploaded Successfully", description: "Your ID has been submitted and is pending verification. You will be redirected shortly." });
      // The server action `uploadIdDocument` now calls `updateUserVerificationStatus`.
      // For this scaffold, we assume verification is immediate.
      // Re-fetching user or relying on AuthContext update (which might need a manual trigger or listen to Firestore changes)
      // For now, just redirect. The AuthContext will eventually pick up the change on next load or if user data is actively refreshed.
      router.push('/dashboard'); 
    } else {
      console.error("Detailed error: ID document upload failed. Server action response:", result.error);
      toast({
        title: "ID Document Upload Failed",
        description: `Failed to upload your ID document. The system reported: ${result.error || "An unknown error occurred during the upload process."} Please ensure your file meets the requirements (JPG, PNG, or PDF, max 5MB) and try again. If the issue persists, contact support.`,
        variant: "destructive",
      });
    }
    setLoading(false);
  }
  
  if (authLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (kycVerified) { // Changed userProfile?.isVerified to kycVerified
     router.replace('/dashboard');
     return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">You are already verified. Redirecting to dashboard...</p></div>;
  }


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="idDocument"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Upload ID Document</FormLabel>
              <FormControl>
                <div className="relative flex items-center justify-center w-full">
                  <label
                    htmlFor="idDocument-upload"
                    className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer border-input bg-card hover:border-primary hover:bg-accent/10 transition-colors"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                      <p className="mb-2 text-sm text-muted-foreground">
                        <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">JPG, PNG, or PDF (MAX. 5MB)</p>
                      {fileName && <p className="text-xs text-primary mt-2">{fileName}</p>}
                    </div>
                    <Input
                      id="idDocument-upload"
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loading || authLoading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit for Verification
        </Button>
         <p className="text-xs text-center text-muted-foreground">
          Verification helps maintain a trustworthy debate environment. Your data is handled securely according to our privacy policy.
        </p>
      </form>
    </Form>
  );
}
