import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle, Files, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Contract, Template } from "@shared/schema";

export default function Dashboard() {
  const { data: contracts, isLoading: contractsLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: templates, isLoading: templatesLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const stats = {
    totalContracts: contracts?.length || 0,
    pendingValidation: contracts?.filter(c => c.status === "pending").length || 0,
    activeTemplates: templates?.length || 0,
    validatedContracts: contracts?.filter(c => c.status === "validated").length || 0,
  };

  const isLoading = contractsLoading || templatesLoading;

  const statCards = [
    {
      title: "Total Contracts",
      value: stats.totalContracts,
      icon: FileText,
      trend: "+12%",
      testId: "stat-total-contracts",
    },
    {
      title: "Pending Validation",
      value: stats.pendingValidation,
      icon: CheckCircle,
      trend: "-5%",
      testId: "stat-pending-validation",
    },
    {
      title: "Active Templates",
      value: stats.activeTemplates,
      icon: Files,
      trend: "+3",
      testId: "stat-active-templates",
    },
  ];

  const recentContracts = contracts?.slice(0, 5) || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold mb-2" data-testid="text-page-title">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your contract management system
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <>
                  <div className="text-4xl font-bold" data-testid={stat.testId}>
                    {stat.value}
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    <span>{stat.trend} from last month</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Recent Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : recentContracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No contracts yet</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Get started by generating your first contract
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentContracts.map((contract) => (
                <div
                  key={contract.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover-elevate"
                  data-testid={`contract-item-${contract.id}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h4 className="font-medium">{contract.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {contract.contractType} • {new Date(contract.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-medium px-3 py-1 rounded-full ${
                        contract.status === "validated"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : contract.status === "pending"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                          : contract.status === "active"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                      data-testid={`status-${contract.id}`}
                    >
                      {contract.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
