import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Sparkles, FileText, CheckCircle, Loader2, Zap, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { downloadAsDocx } from "@/lib/downloadUtils";

type GenerationStep = "proposal" | "generating" | "review";

export default function Generate() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState<GenerationStep>("proposal");
  const [proposal, setProposal] = useState("");
  const [contractTitle, setContractTitle] = useState("");
  const [contractType, setContractType] = useState("");
  const [parties, setParties] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [contractId, setContractId] = useState<string | null>(null);
  const [ragInfo, setRagInfo] = useState({ templatesUsed: 0, templateId: null });
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async () => {
      setCurrentStep("generating");
      setProgress(20);
      
      const response = await apiRequest("POST", "/api/contracts/generate", {
        proposal,
        contractTitle,
        contractType,
        parties: parties.split(",").map((p) => p.trim()).filter(Boolean),
      });
      
      setProgress(100);
      return response;
    },
    onSuccess: (data: any) => {
      setGeneratedContent(data.content);
      setContractId(data.contractId);
      setRagInfo({
        templatesUsed: data.ragTemplatesUsed || 0,
        templateId: data.templateId,
      });
      setCurrentStep("review");
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({
        title: "Contract generated",
        description: "AI has generated your contract draft using RAG-based template retrieval.",
      });
    },
    onError: (error: Error) => {
      setCurrentStep("proposal");
      setProgress(0);
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const downloadContract = async () => {
    try {
      await downloadAsDocx(generatedContent, contractTitle || 'contract');
      toast({
        title: "Contract downloaded",
        description: "Your contract has been downloaded as a Word document.",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download contract. Please try again.",
        variant: "destructive",
      });
    }
  };

  const steps = [
    { id: "proposal", label: "Business Proposal", icon: Sparkles },
    { id: "generating", label: "RAG Generation", icon: Loader2 },
    { id: "review", label: "Review & Save", icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2" data-testid="text-page-title">
          Generate Contract
        </h1>
        <p className="text-muted-foreground">
          RAG-powered contract generation with semantic template matching
        </p>
      </div>

      <Alert className="border-primary/50 bg-primary/5">
        <Zap className="h-4 w-4" />
        <AlertDescription>
          <strong>RAG Technology:</strong> This system uses Retrieval-Augmented Generation to automatically find the most relevant legal templates from your library using semantic search, then generates customized contracts based on your business proposal.
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;
          
          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCompleted
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${step.id === "generating" && isActive ? "animate-spin" : ""}`} />
                </div>
                <span className={`mt-2 text-xs font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 ${isCompleted ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {currentStep === "proposal" && (
        <Card>
          <CardHeader>
            <CardTitle>Business Proposal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contract-title">Contract Title</Label>
              <Input
                id="contract-title"
                placeholder="e.g., Service Agreement with Acme Corp"
                value={contractTitle}
                onChange={(e) => setContractTitle(e.target.value)}
                data-testid="input-contract-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract-type">Contract Type</Label>
              <Input
                id="contract-type"
                placeholder="e.g., Service Agreement, NDA, Employment Contract"
                value={contractType}
                onChange={(e) => setContractType(e.target.value)}
                data-testid="input-contract-type"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parties">Parties (comma-separated)</Label>
              <Input
                id="parties"
                placeholder="e.g., Acme Corp, Your Company Inc"
                value={parties}
                onChange={(e) => setParties(e.target.value)}
                data-testid="input-parties"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proposal">Business Proposal</Label>
              <Textarea
                id="proposal"
                placeholder="Describe the business requirements, terms, conditions, and specific clauses for this contract. The AI will use semantic search to find the most relevant templates from your library and generate a customized contract based on your requirements."
                className="min-h-64"
                value={proposal}
                onChange={(e) => setProposal(e.target.value)}
                data-testid="textarea-proposal"
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!proposal || !contractTitle || !contractType}
                data-testid="button-generate-contract"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate with RAG
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === "generating" && (
        <Card>
          <CardContent className="py-16 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-6" />
            <h3 className="text-xl font-medium mb-2">Generating Your Contract</h3>
            <p className="text-muted-foreground mb-2">
              Step 1: Embedding your proposal for semantic search...
            </p>
            <p className="text-muted-foreground mb-6">
              Step 2: Retrieving most relevant templates from vector database...
            </p>
            <Progress value={progress} className="max-w-md mx-auto" />
          </CardContent>
        </Card>
      )}

      {currentStep === "review" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Review Generated Contract</span>
              {ragInfo.templatesUsed > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  RAG: {ragInfo.templatesUsed} template{ragInfo.templatesUsed !== 1 ? 's' : ''} analyzed
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Contract successfully generated using RAG-based template retrieval and saved to your contracts library.
              </AlertDescription>
            </Alert>
            <div className="rounded-lg border bg-muted/50 p-6">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap font-mono text-sm" data-testid="text-generated-content">
                  {generatedContent}
                </div>
              </div>
            </div>
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentStep("proposal");
                  setProgress(0);
                }}
                data-testid="button-regenerate"
              >
                Generate Another
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={downloadContract}
                  data-testid="button-download-contract"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  onClick={() => setLocation("/contracts")}
                  data-testid="button-view-contracts"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View All Contracts
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
