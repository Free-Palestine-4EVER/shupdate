"use client"

import type * as React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"

const Dialog = ({ children, ...props }: React.ComponentProps<typeof AlertDialog>) => {
  return <AlertDialog {...props}>{children}</AlertDialog>
}

const DialogTrigger = AlertDialogTrigger
const DialogContent = AlertDialogContent
const DialogHeader = AlertDialogHeader
const DialogFooter = AlertDialogFooter
const DialogTitle = AlertDialogTitle
const DialogDescription = AlertDialogDescription
const DialogAction = AlertDialogAction
const DialogCancel = AlertDialogCancel

const DialogTabs = Tabs
const DialogTab = TabsContent
const DialogClose = ({ children, ...props }: React.ComponentProps<typeof Button>) => {
  return (
    <Button variant="ghost" size="sm" className="absolute right-4 top-4 md:right-6 md:top-6" {...props}>
      {children}
    </Button>
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogAction,
  DialogCancel,
  DialogTabs,
  DialogTab,
  DialogClose,
}
