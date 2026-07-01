// The demo. This is Animate UI's `animate` Tabs primitive (motion + Tailwind, no Base UI/Radix),
// copied in unmodified under components/animate-ui/, running inside a Vike + React app. The point
// of this sandbox is that the component works here as-is; parts get harvested into the vike-*
// extensions from here.
import '../../styles.css'
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsHighlight,
  TabsHighlightItem,
  TabsList,
  TabsTrigger,
} from '@/components/animate-ui/primitives/animate/tabs'
import {
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionTrigger,
  AccordionPanel,
} from '@/components/animate-ui/primitives/base/accordion'
import {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/animate-ui/primitives/base/dialog'

export default function Page() {
  return (
    <div style={{ maxWidth: 560, margin: '3rem auto', padding: '0 1rem' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Animate UI in Vike</h1>
      <p style={{ color: 'var(--muted-foreground)', fontSize: 14, marginBottom: 24 }}>
        The <code>animate</code> Tabs primitive (motion + Tailwind), copied in via the shadcn-style registry and running
        under Vike SSR. The highlight slides between tabs; panels animate their height.
      </p>

      <Tabs defaultValue="account" className="w-full">
        <TabsHighlight className="bg-background absolute z-0 inset-0 rounded-md shadow-sm">
          <TabsList className="h-10 inline-flex p-1 bg-accent w-full rounded-lg">
            <TabsHighlightItem value="account" className="flex-1">
              <TabsTrigger value="account" className="h-full px-4 py-2 w-full text-sm rounded-md">
                Account
              </TabsTrigger>
            </TabsHighlightItem>
            <TabsHighlightItem value="password" className="flex-1">
              <TabsTrigger value="password" className="h-full px-4 py-2 w-full text-sm rounded-md">
                Password
              </TabsTrigger>
            </TabsHighlightItem>
          </TabsList>
        </TabsHighlight>

        <TabsContents className="mt-3 border rounded-lg p-4">
          <TabsContent value="account" className="space-y-3">
            <p className="text-sm text-muted-foreground">Make changes to your account here.</p>
            <label className="text-sm flex flex-col gap-1">
              Name
              <input defaultValue="Pedro Duarte" className="border rounded-md px-3 py-1.5 text-sm" />
            </label>
            <button className="bg-primary text-primary-foreground px-3 py-1.5 text-sm rounded-md">Save changes</button>
          </TabsContent>
          <TabsContent value="password" className="space-y-3">
            <p className="text-sm text-muted-foreground">Change your password here.</p>
            <label className="text-sm flex flex-col gap-1">
              New password
              <input type="password" className="border rounded-md px-3 py-1.5 text-sm" />
            </label>
            <button className="bg-primary text-primary-foreground px-3 py-1.5 text-sm rounded-md">Save password</button>
          </TabsContent>
        </TabsContents>
      </Tabs>

      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '2.5rem 0 4px' }}>Accordion</h2>
      <p style={{ color: 'var(--muted-foreground)', fontSize: 14, marginBottom: 16 }}>
        The <code>base</code> Accordion primitive (Base UI + motion), copied in via the registry. The panel height morphs
        open/closed. This is the reference the dep-free vike-blocks <code>accordion</code> block was harvested from.
      </p>
      <Accordion defaultValue={['what']} className="border rounded-lg divide-y">
        <AccordionItem value="what" className="px-4">
          <AccordionHeader>
            <AccordionTrigger className="flex w-full items-center justify-between py-3 text-sm font-medium">
              What is a block?
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel className="text-sm text-muted-foreground">
            <p className="pb-3">A block is one section of a page — a composition of nested blocks.</p>
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem value="animate" className="px-4">
          <AccordionHeader>
            <AccordionTrigger className="flex w-full items-center justify-between py-3 text-sm font-medium">
              How does it animate?
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel className="text-sm text-muted-foreground">
            <p className="pb-3">The panel morphs height between 0 and auto. The native block re-implements this with a measured CSS transition, dep-free.</p>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>

      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '2.5rem 0 4px' }}>Dialog</h2>
      <p style={{ color: 'var(--muted-foreground)', fontSize: 14, marginBottom: 16 }}>
        The <code>base</code> Dialog primitive (Base UI + motion): portal, backdrop, focus trap, Escape / outside-click. This
        is the reference the dep-free vike-blocks <code>dialog</code> block was harvested from.
      </p>
      <Dialog>
        <DialogTrigger className="bg-primary text-primary-foreground px-3 py-1.5 text-sm rounded-md">
          Open dialog
        </DialogTrigger>
        <DialogPortal>
          <DialogBackdrop className="fixed inset-0 bg-black/50 z-40" />
          <DialogPopup className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-background border rounded-lg p-5 shadow-xl">
            <DialogTitle className="text-base font-semibold">Delete post</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              This action cannot be undone.
            </DialogDescription>
            <div className="flex justify-end gap-2 mt-5">
              <DialogClose className="border px-3 py-1.5 text-sm rounded-md">Cancel</DialogClose>
              <DialogClose className="bg-primary text-primary-foreground px-3 py-1.5 text-sm rounded-md">Delete</DialogClose>
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </div>
  )
}
