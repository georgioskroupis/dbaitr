
"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { seedMultiTopicTestData } from "@/lib/seedDatabase"; 
import { Loader2, DatabaseZap } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

export default function SeedFirestorePage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSeedData = async () => {
    setIsLoading(true);
    try {
      const result = await seedMultiTopicTestData(); 
      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
          variant: "default", 
          duration: 5000,
        });
      } else {
        toast({
          title: "Seeding Failed",
          description: result.message,
          variant: "destructive",
          duration: 9000,
        });
      }
    } catch (error: any) {
      console.error("Client-side error encountered while calling the seed function:", error);
      toast({
        title: "Client Error",
        description: `An unexpected error occurred on the client-side when trying to trigger the seed process. Details: ${error.message || 'Unknown client error. Check console for more information.'}`,
        variant: "destructive",
        duration: 9000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-lg mx-auto bg-black/40 backdrop-blur-md p-6 rounded-xl shadow-md border border-white/10">
        <CardHeader className="p-0 mb-4">
          <CardTitle className="flex items-center gap-2 text-2xl text-white font-semibold">
            <DatabaseZap className="h-7 w-7 text-rose-400" />
            Firestore Multi-Topic Data Seeder
          </CardTitle>
          <CardDescription className="text-white/50">
            This tool will write a predefined set of 4 controversial debate topics (AI Regulation, Remote Work, Crypto Banking, Meat Ban) and associated data to your Firestore database. 
            It's designed for development and testing to ensure Firestore connectivity and schema alignment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-0">
          <Alert variant="destructive" className="border-destructive/70 bg-destructive/20 text-destructive-foreground">
            <Terminal className="h-5 w-5 text-destructive" />
            <AlertTitle className="font-semibold text-destructive">Use With Caution!</AlertTitle>
            <AlertDescription className="text-destructive/90">
              Running this action will overwrite or create specific documents in your Firestore database. 
              Ensure you understand the data being written, especially in non-development environments.
            </AlertDescription>
          </Alert>
          
          <Button onClick={handleSeedData} disabled={isLoading} className="w-full text-base py-3 px-5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold shadow-lg shadow-black/20 transition">
            {isLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <DatabaseZap className="mr-2 h-5 w-5" />
            )}
            Seed Firestore with Multi-Topic Data
          </Button>
           <p className="mt-4 text-xs text-white/50 text-center px-2">
            The test data includes: 1 user (user_test), 4 new topics (AI Regulation, Remote Work, Crypto Banking, Meat Ban), 
            each with 2 statements (one 'for', one 'against'), and 1 question under one statement per topic.
            This may also include previously seeded data if not cleared. Check Firestore console after seeding.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
