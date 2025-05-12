
"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { seedTestData } from "@/lib/seedDatabase"; // Updated to use the generic seedTestData function
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
      const result = await seedTestData(); // Call the seeding function
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
      <Card className="max-w-lg mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <DatabaseZap className="h-7 w-7 text-primary" />
            Firestore Test Data Seeder
          </CardTitle>
          <CardDescription>
            This tool will write a predefined set of test documents to your Firestore database. 
            It's designed for development and testing to ensure Firestore connectivity and schema alignment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="destructive" className="border-destructive/70 bg-destructive/10">
            <Terminal className="h-5 w-5 text-destructive" />
            <AlertTitle className="font-semibold text-destructive">Use With Caution!</AlertTitle>
            <AlertDescription className="text-destructive/90">
              Running this action will overwrite or create specific documents in your Firestore database. 
              Ensure you understand the data being written, especially in non-development environments.
            </AlertDescription>
          </Alert>
          
          <Button onClick={handleSeedData} disabled={isLoading} className="w-full text-base py-3">
            {isLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <DatabaseZap className="mr-2 h-5 w-5" />
            )}
            Seed Firestore with Test Data
          </Button>
           <p className="mt-4 text-xs text-muted-foreground text-center px-2">
            The test data includes: 1 user (user_test), 1 topic (topic_tiktok concerning government bans), 
            2 statements (one 'for', one 'against'), and 1 question under the 'for' statement.
            Check Firestore console after seeding.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
