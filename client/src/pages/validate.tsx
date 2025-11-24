import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, AlertTriangle, Info, Loader2, FileText } from "lucide-react";
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
  const { toast } = useToast();

  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/contracts/validate", {
        contractId: selectedContractId,
        proposalText,
      });
      return response as ValidationResult;
    },
    onSuccess: (data) => {
      setValidationResult(data);
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

  const selectedContract = contracts?.find((c) => c.id === selectedContractId);

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
            <div className="space-y-2">
              <Label htmlFor="contract-select">Select Contract</Label>
              <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                <SelectTrigger id="contract-select" data-testid="select-contract">
                  <SelectValue placeholder="Choose a contract" />
                </SelectTrigger>
                <SelectContent>
                  {contracts?.map((contract) => (
                    <SelectItem key={contract.id} value={contract.id}>
                      {contract.title} ({contract.status})
                    </SelectItem>
                  ))}
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

            <Button
              className="w-full"
              onClick={() => validateMutation.mutate()}
              disabled={!selectedContractId || !proposalText || validateMutation.isPending}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
