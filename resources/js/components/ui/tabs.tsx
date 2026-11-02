import type { ComponentProps } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../lib/utils';

// Tabs gaya shadcn/ui (di atas @radix-ui/react-tabs): daftar tab berbentuk "segmented pill",
// tab aktif diberi garis tepi + teks tebal: hitam (mode terang) / putih (mode gelap), tanpa isi. Warna aktif memakai nilai hex supaya tidak
// ikut tertimpa aturan `html.dark .bg-white / .text-slate-* { ... !important }` di index.css.
function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col gap-2', className)} {...props} />;
}

function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn('inline-flex h-10 items-center gap-1 rounded-lg bg-slate-100 p-1 text-slate-500', className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex h-7 shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent px-2 text-sm font-medium whitespace-nowrap',
        'text-[#71717a] dark:text-[#a1a1aa] transition-all disabled:pointer-events-none disabled:opacity-50',
        'data-[state=inactive]:hover:text-[#18181b] dark:data-[state=inactive]:hover:text-[#ffffff]',
        'data-[state=active]:border-[#18181b] data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-[#18181b]',
        'dark:data-[state=active]:border-[#e4e4e7] dark:data-[state=active]:text-[#ffffff]',
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn('flex-1 outline-none', className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
