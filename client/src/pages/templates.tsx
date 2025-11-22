import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Files, Upload, Search, Plus, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTemplateSchema, type InsertTemplate, type Template } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Templates() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<"file" | "manual">("file");
  const { toast } = useToast();

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const form = useForm<InsertTemplate>({
    resolver: zodResolver(insertTemplateSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "other",
      description: "",
    },
  });

  // File upload state
  const [fileUploadData, setFileUploadData] = useState({
    title: "",
    category: "other",
    description: "",
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: InsertTemplate) => {
      return await apiRequest("POST", "/api/templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template uploaded",
        description: "Your template has been uploaded and indexed successfully.",
      });
      setIsDialogOpen(false);
      form.reset();
      setSelectedFile(null);
      setFileUploadData({ title: "", category: "other", description: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const fileUploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/templates/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload template");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template uploaded",
        description: "Your template file has been uploaded and indexed successfully.",
      });
      setIsDialogOpen(false);
      setSelectedFile(null);
      setFileUploadData({ title: "", category: "other", description: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredTemplates = templates?.filter((template) => {
    const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || template.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }) || [];

  const onSubmit = (data: InsertTemplate) => {
    uploadMutation.mutate(data);
  };

  const handleFileUpload = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    if (!fileUploadData.title || !fileUploadData.category) {
      toast({
        title: "Missing information",
        description: "Please provide a title and category",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("title", fileUploadData.title);
    formData.append("category", fileUploadData.category);
    formData.append("description", fileUploadData.description);

    fileUploadMutation.mutate(formData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2" data-testid="text-page-title">Templates</h1>
          <p className="text-muted-foreground">
            Pre-approved legal templates for contract generation
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-upload-template">
              <Upload className="h-4 w-4 mr-2" />
              Upload Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload New Template</DialogTitle>
              <DialogDescription>
                Add a new legal template to the library for AI-powered contract generation
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="file" className="w-full" onValueChange={(value) => setUploadMode(value as "file" | "manual")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </TabsTrigger>
                <TabsTrigger value="manual">
                  <FileText className="h-4 w-4 mr-2" />
                  Manual Input
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="space-y-4 mt-4">
                <form onSubmit={handleFileUpload} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="file-upload">Template File</Label>
                    <div className="flex flex-col gap-2">
                      <Input
                        id="file-upload"
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={handleFileChange}
                        data-testid="input-file-upload"
                      />
                      <p className="text-xs text-muted-foreground">
                        Supported formats: PDF, DOCX, TXT (Max 10MB)
                      </p>
                      {selectedFile && (
                        <p className="text-sm text-green-600">
                          Selected: {selectedFile.name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="file-title">Template Title</Label>
                    <Input
                      id="file-title"
                      placeholder="e.g., Standard NDA Agreement"
                      value={fileUploadData.title}
                      onChange={(e) => setFileUploadData({ ...fileUploadData, title: e.target.value })}
                      data-testid="input-file-template-title"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="file-category">Category</Label>
                    <Select
                      value={fileUploadData.category}
                      onValueChange={(value) => setFileUploadData({ ...fileUploadData, category: value })}
                    >
                      <SelectTrigger id="file-category" data-testid="select-file-template-category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nda">NDA</SelectItem>
                        <SelectItem value="employment">Employment</SelectItem>
                        <SelectItem value="service_agreement">Service Agreement</SelectItem>
                        <SelectItem value="partnership">Partnership</SelectItem>
                        <SelectItem value="lease">Lease</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="file-description">Description (Optional)</Label>
                    <Input
                      id="file-description"
                      placeholder="Brief description of this template"
                      value={fileUploadData.description}
                      onChange={(e) => setFileUploadData({ ...fileUploadData, description: e.target.value })}
                      data-testid="input-file-template-description"
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      data-testid="button-cancel-file-upload"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={fileUploadMutation.isPending}
                      data-testid="button-submit-file-template"
                    >
                      {fileUploadMutation.isPending ? "Uploading..." : "Upload Template"}
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="manual" className="space-y-4 mt-4">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template Title</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Standard NDA Agreement"
                              {...field}
                              data-testid="input-template-title"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-template-category">
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="nda">NDA</SelectItem>
                              <SelectItem value="employment">Employment</SelectItem>
                              <SelectItem value="service_agreement">Service Agreement</SelectItem>
                              <SelectItem value="partnership">Partnership</SelectItem>
                              <SelectItem value="lease">Lease</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Brief description of this template"
                              {...field}
                              value={field.value || ""}
                              data-testid="input-template-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template Content</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Paste your legal template content here..."
                              className="min-h-64 font-mono text-sm"
                              {...field}
                              data-testid="textarea-template-content"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                        data-testid="button-cancel-upload"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={uploadMutation.isPending}
                        data-testid="button-submit-template"
                      >
                        {uploadMutation.isPending ? "Uploading..." : "Upload Template"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-templates"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-category-filter">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="nda">NDA</SelectItem>
            <SelectItem value="employment">Employment</SelectItem>
            <SelectItem value="service_agreement">Service Agreement</SelectItem>
            <SelectItem value="partnership">Partnership</SelectItem>
            <SelectItem value="lease">Lease</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </>
        ) : filteredTemplates.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Files className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium mb-2">No templates found</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                {searchQuery || categoryFilter !== "all"
                  ? "Try adjusting your filters or search query"
                  : "Upload your first legal template to get started"}
              </p>
              <Button onClick={() => setIsDialogOpen(true)} data-testid="button-upload-first-template">
                <Plus className="h-4 w-4 mr-2" />
                Upload First Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredTemplates.map((template) => (
            <Card key={template.id} className="hover-elevate" data-testid={`template-card-${template.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <Files className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg mb-2" data-testid={`template-title-${template.id}`}>
                      {template.title}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {template.category.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {template.description && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {template.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Used {template.usageCount} times</span>
                  <span>{new Date(template.createdAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
