"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Calculator, Store } from "lucide-react";
import { updateSystemSettings } from "@/app/actions/settings";
import { MallWhitelistManager } from "./mall-whitelist-manager";
// import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  fee_percentage: z.coerce.number().min(0).max(100),
  min_fee: z.coerce.number().min(0),
  max_fee: z.coerce.number().min(0),
});

type FormValues = z.infer<typeof formSchema>;

interface MarginSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: FormValues;
  onSuccess: (data: FormValues) => void;
}

export function MarginSettingsDialog({
  isOpen,
  onClose,
  initialData,
  onSuccess,
}: MarginSettingsDialogProps) {
  const [activeTab, setActiveTab] = React.useState<"fees" | "malls">("fees");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  // const { toast } = useToast(); // hooks/use-toast.ts가 있는지 확인 필요

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData,
  });

  // initialData가 변경될 때 폼 값을 리셋합니다.
  React.useEffect(() => {
    form.reset(initialData);
  }, [initialData, form]);

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const res = await updateSystemSettings({
        fee_percentage: values.fee_percentage,
        min_fee: values.min_fee,
        max_fee: values.max_fee,
      });
      if (res.success) {
        onSuccess(values);
        onClose();
        // toast({ title: "설정이 저장되었습니다." });
        alert("설정이 저장되었습니다.");
      } else {
        alert("오류 발생: " + res.error);
      }
    } catch (error: any) {
      alert("오류 발생: " + error.message);
    } finally {
      setIsSubmitting(true); // 오타 방지용으로 false로 바꿔야 함
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] border-secondary/40 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Calculator className="w-5 h-5 text-primary" />
            마진 설정 (Margin Settings)
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-medium">
            전역 수수료 정책을 설정합니다. 모든 계산에 즉시 반영됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex bg-secondary/20 p-1 rounded-lg mb-4">
          <button 
            onClick={() => setActiveTab("fees")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-[12px] font-bold rounded-md transition-all ${activeTab === "fees" ? "bg-background shadow-sm text-primary" : "text-muted-foreground"}`}
          >
            <Calculator size={14} /> 수수료 설정
          </button>
          <button 
            onClick={() => setActiveTab("malls")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-[12px] font-bold rounded-md transition-all ${activeTab === "malls" ? "bg-background shadow-sm text-primary" : "text-muted-foreground"}`}
          >
            <Store size={14} /> 쇼핑몰 관리
          </button>
        </div>

        {activeTab === "fees" ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fee_percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold text-[13px]">기본 수수료율 (%)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input {...field} type="number" step="0.01" className="bg-secondary/20 border-none font-mono font-bold pl-3 pr-8" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">%</span>
                      </div>
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="min_fee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-[13px]">최소 수수료 (₩)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input {...field} type="number" className="bg-secondary/20 border-none font-mono font-bold pl-3 pr-8" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">₩</span>
                        </div>
                      </FormControl>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max_fee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-[13px]">최대 수수료 (₩)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input {...field} type="number" className="bg-secondary/20 border-none font-mono font-bold pl-3 pr-8" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">₩</span>
                        </div>
                      </FormControl>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="bg-primary/5 p-3 rounded-lg border border-primary/10">
                <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider mb-1">계산 방식 안내</h4>
                <p className="text-[12px] text-muted-foreground leading-tight">
                  수수료 = 판매가 × {form.watch("fee_percentage")}%<br />
                  단, 최소 {Number(form.watch("min_fee")).toLocaleString()}원 ~ 최대 {Number(form.watch("max_fee")).toLocaleString()}원 사이로 제한됩니다.
                </p>
              </div>

              <DialogFooter className="pt-4 border-t border-secondary/10">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting} className="font-semibold text-xs">취소</Button>
                <Button type="submit" disabled={isSubmitting} className="font-bold text-xs bg-primary hover:bg-primary/90">
                  {isSubmitting && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
                  설정 저장
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            <MallWhitelistManager />
            <div className="pt-4 border-t border-secondary/10 flex justify-end">
              <Button type="button" onClick={onClose} className="font-bold text-xs">닫기</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
