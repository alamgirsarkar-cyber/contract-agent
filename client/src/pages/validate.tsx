import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, AlertTriangle, Info, Loader2, FileText, Upload, X, ThumbsUp, ThumbsDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Contract } from "@shared/schema";
import { Alert, AlertDescription } from "@/components/ui/alert";

type ValidationResult = {
  status: "compliant" | "issues_found" | "failed";
  issues?: Array<{
    type: "error" | "warning" | "info";
    message: string;
    section?: string;
  }>;
  summary: string;
};

export default function Validate() {
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [proposalText, setProposalText] = useState("");
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileContent, setUploadedFileContent] = useState<string>("");
  const [contractSource, setContractSource] = useState<"existing" | "upload">("existing");
  const [feedback, setFeedback] = useState<"approved" | "rejected" | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const { toast } = useToast();

  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];

    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.txt') && !file.name.endsWith('.pdf') && !file.name.endsWith('.docx') && !file.name.endsWith('.doc')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a TXT, PDF, or DOCX file.",
        variant: "destructive",
      });
      return;
    }

    setUploadedFile(file);

    // Read file content for text files
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setUploadedFileContent(content);
      };
      reader.readAsText(file);
    } else {
      // For PDF and DOCX, we'll send the file to the server for parsing
      setUploadedFileContent(`[${file.name}]`);
    }
  };

  const removeUploadedFile = () => {
    setUploadedFile(null);
    setUploadedFileContent("");
  };

  const validateMutation = useMutation({
    mutationFn: async () => {
      if (contractSource === "upload" && uploadedFile) {
        const formData = new FormData();
        formData.append("file", uploadedFile);
        formData.append("proposalText", proposalText);

        const response = await fetch("/api/contracts/validate-upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Validation failed");
        }

        return response.json() as Promise<ValidationResult>;
      } else {
        const response = await apiRequest("POST", "/api/contracts/validate", {
          contractId: selectedContractId,
          proposalText,
        });
        return response as ValidationResult;
      }
    },
    onSuccess: (data) => {
      setValidationResult(data);
      setFeedback(null);
      setFeedbackComment("");
      toast({
        title: "Validation complete",
        description: "Contract has been validated against the business proposal.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Validation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const submitFeedback = async () => {
    if (!feedback || !validationResult) return;

    try {
      await apiRequest("POST", "/api/contracts/validate-feedback", {
        contractId: contractSource === "existing" ? selectedContractId : null,
        fileName: uploadedFile?.name,
        feedback,
        comment: feedbackComment,
        validationResult,
      });

      toast({
        title: "Feedback submitted",
        description: "Thank you for your feedback!",
      });
    } catch (error) {
      toast({
        title: "Failed to submit feedback",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const selectedContract = contracts?.find((c) => c.id === selectedContractId);

  const canValidate = proposalText &&
    ((contractSource === "existing" && selectedContractId) ||
     (contractSource === "upload" && uploadedFile));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2" data-testid="text-page-title">
          Validate Contract
        </h1>
        <p className="text-muted-foreground">
          AI-powered validation against business proposals
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Business Proposal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="proposal">Original Proposal or Requirements</Label>
              <Textarea
                id="proposal"
                placeholder="Paste the business proposal or requirements that the contract should comply with..."
                className="min-h-96 font-mono text-sm"
                value={proposalText}
                onChange={(e) => setProposalText(e.target.value)}
                data-testid="textarea-proposal"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contract to Validate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={contractSource} onValueChange={(v) => setContractSource(v as "existing" | "upload")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing">Existing Contract</TabsTrigger>
                <TabsTrigger value="upload">Upload File</TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contract-select">Select Contract</Label>
                  <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                    <SelectTrigger id="contract-select" data-testid="select-contract">
                      <SelectValue placeholder="Choose a contract" />
                    </SelectTrigger>
                    <SelectContent>
                      {contracts && contracts.length > 0 ? (
                        contracts.map((contract) => (
                          <SelectItem key={contract.id} value={contract.id}>
                            {contract.title} ({contract.status})
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                          No contracts available. Generate a contract first.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {selectedContract && (
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <FileText className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium">{selectedContract.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedContract.contractType}
                        </p>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-xs font-mono text-muted-foreground">
                        {selectedContract.content.substring(0, 500)}...
                      </pre>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="upload" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="file-upload">Upload Contract File</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".txt,.pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("file-upload")?.click()}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadedFile ? "Change File" : "Choose File"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: TXT, PDF, DOC, DOCX
                  </p>
                </div>

                {uploadedFile && (
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <FileText className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium">{uploadedFile.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {(uploadedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeUploadedFile}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {uploadedFileContent && uploadedFileContent !== `[${uploadedFile.name}]` && (
                      <div className="max-h-64 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-xs font-mono text-muted-foreground">
                          {uploadedFileContent.substring(0, 500)}...
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <Button
              className="w-full"
              onClick={() => validateMutation.mutate()}
              disabled={!canValidate || validateMutation.isPending}
              data-testid="button-validate"
            >
              {validateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Validate Contract
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {validationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {validationResult.status === "compliant" ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              )}
              Validation Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert
              className={
                validationResult.status === "compliant"
                  ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
                  : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
              }
            >
              <AlertDescription className="text-sm" data-testid="text-validation-summary">
                {validationResult.summary}
              </AlertDescription>
            </Alert>

            {validationResult.issues && validationResult.issues.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Issues & Suggestions</h4>
                {validationResult.issues.map((issue, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-4 rounded-lg border ${
                      issue.type === "error"
                        ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                        : issue.type === "warning"
                        ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
                        : "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30"
                    }`}
                    data-testid={`validation-issue-${index}`}
                  >
                    {issue.type === "error" ? (
                      <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    ) : issue.type === "warning" ? (
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      {issue.section && (
                        <p className="text-xs font-medium uppercase tracking-wide mb-1 opacity-70">
                          {issue.section}
                        </p>
                      )}
                      <p className="text-sm">{issue.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-4 mt-6">
              <h4 className="font-medium mb-4">Provide Feedback</h4>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <Button
                    variant={feedback === "approved" ? "default" : "outline"}
                    className={feedback === "approved" ? "bg-green-600 hover:bg-green-700" : ""}
                    onClick={() => setFeedback("approved")}
                  >
                    <ThumbsUp className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant={feedback === "rejected" ? "default" : "outline"}
                    className={feedback === "rejected" ? "bg-red-600 hover:bg-red-700" : ""}
                    onClick={() => setFeedback("rejected")}
                  >
                    <ThumbsDown className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>

                {feedback && (
                  <div className="space-y-2">
                    <Label htmlFor="feedback-comment">Comment (optional)</Label>
                    <Textarea
                      id="feedback-comment"
                      placeholder="Add any additional comments about the validation..."
                      className="min-h-24"
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                    />
                    <Button onClick={submitFeedback} className="w-full">
                      Submit Feedback
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
