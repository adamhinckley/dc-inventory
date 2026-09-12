# Adam Hinckley and David Smith

**Date:** 2026-09-12
**Source:** Email (Adam's written questions; David's replies). Filed like a call transcript for the repo.
**Topic:** Order release, pick lists, iPad warehouse check/scan, invoice timing.

Adam had emailed questions about SoloView-style order release and an iPad-friendly pick list. David answered in writing. Speaker turns below are those Q&A pairs, cleaned for names and readability. Wording stays close to what each person wrote.

## Warehouse on the iPad

**Adam Hinckley.** When someone is checking or scanning items as they go, what should happen? Should it work like paper, where checkmarks are just a helper so they can see what's done on that device? Or should checks and scans save in the system so someone else can see progress from another screen?

**David Smith.** I think the original plan was to build it so they could technically pick orders from an iPad instead of paper. A check on the screen would be great to tell them they have the correct item. This would basically allow them to have an order pulled up and scan a UPC on the outside of the box and the system could tell them how many pcs or inner boxes they need. Then the person checking could basically scan one UPC on each box and the system would add up to the total. I guess this is if the boxes get out of order then as long as they scan all the UPCs on the boxes they would get added together to meet the total.

The screen at checking would then highlight the box with the check mark green for correct and red if there is a problem. If there is a problem, it would then label the problem on the item (too few of the correct item, too many of the correct item, not the right item) and give them the option to screenshot or export the problem to a PDF or something so we could keep track. Then they could get a manager's approval code to override if necessary. Like they had 144 ordered but only had 120. The manager could use an override code and it would adjust the inventory based on the fact they didn't have enough of the item.

**Adam Hinckley.** When picking is done and the order is ready to ship, is that when the invoice gets created? I'm assuming pick-in-progress is still limbo, and the invoice only happens when it actually ships, same as now.

**David Smith.** Yes. After the pick list is checked they would then use the newly adjusted numbers (if necessary) to invoice the items being shipped. There should be a way to add tracking or integrate tracking. Also a way to add shipping fees. We also need an additional fee space. We rarely but sometimes have charged a rush fee or have an additional handling fee or tariff fee.

## Release and pick in progress

**Adam Hinckley.** After Release, SoloView moves the order to pick in progress before there's an invoice (I think). Do you want that same kind of order status in the new system?

If someone Releases by mistake, do you need a way to undo it, or is that rare enough that we can skip it for now?

**David Smith.** Yes we would need a way to undo it. It is rarish but does happen.

**Adam Hinckley.** Can the warehouse still ship an order that was never Released, or does every ship have to go through Release first?

**David Smith.** Supposed to be released first. There may could be a quick invoice option like they needed one item and the warehouse went to grab something small and just brought it up to the front office. They could skip release and just straight invoice it and charge them.

**Adam Hinckley.** You do partial shipments. How should that line up with pick lists? For example: Release and print only what's going out now, and leave the rest on the order for a later pick?

**David Smith.** Yes the pick list should only have in-stock items on it. The remainder of the order now in SoloView gets split out into another order with BO for back order in it. I think like the order is 12345 and the remainder of the items would auto split to a new order 12345-BO then if that one has to be split again it would be 12345-BO2, BO3, etc.

## Inventory while picking

**Adam Hinckley.** On the item snapshot you walked me through: 106 on hand, 12 being picked, so 94 open. Do you still want "being picked" as its own number that reduces open stock for the warehouse?

I'm not trying to change what customers can buy here. Once an order is confirmed, that quantity is already committed, so available to sell for everyone else shouldn't move just because we're picking it. Want to make sure that matches how you think about it.

**David Smith.** I'm not sure the answer here. My logic says no need for limbo but as far as I know most WMS do this for some reason. Not sure if it's like an accounting thing. Like it's not paid for or on accounts receivable yet. Not sure.

## Calculate

**Adam Hinckley.** On the release screen, do you want ship % by dollars, by units, or both?

**David Smith.** Dollar amount is best.

**Adam Hinckley.** When two orders need the same item and there isn't enough, how should Calculate choose who gets it? Oldest order, biggest dollar amount, first one selected, or something else?

**David Smith.** I would say oldest order.

**Adam Hinckley.** Do you always Calculate, then Release? Or do you sometimes Release without recalculating?

**David Smith.** I think only time we release without calculating first is when we only release one order.

**Adam Hinckley.** After Calculate, do those assignments need to stick if someone else opens the list, or is Calculate just a preview until you hit Release?

**David Smith.** Calculate is just a preview until release.

## What's on the pick list

**Adam Hinckley.** Do you need the customer PO number on the pick list?

**David Smith.** Yes.

**Adam Hinckley.** Ship Via is on the paper. You've said you don't really use it. Keep it, drop it, or make it optional notes?

**David Smith.** I would make it optional. There are a few customers that have specific trucking companies they want used. Maybe have a few drop down options but also a write in option.

**Adam Hinckley.** Location on each line (IR, YS, and so on). Do pickers still walk by those bin/zone codes, or can we skip that for now with one warehouse?

**David Smith.** We definitely still need this function. It is also in the product details as location of the item.

**Adam Hinckley.** For barcodes, should we encode UPC, item/SKU, or both (order barcode plus line barcodes)?

**David Smith.** It needs both the UPC and the item number. Not 100% I understand the question. May have to have a call for this one. I should have some time tomorrow.

**Adam Hinckley.** SoloView saves a file and also sends to the printer. For a first version, is Print from the iPad plus a PDF download enough, or do you still need auto-send to a warehouse printer on day one?

**David Smith.** Should be enough.

**Adam Hinckley.** Pulled / Checked / Packed / Shipped initials at the bottom. Still useful as blank lines, or skip for now?

**David Smith.** Would like it to be there.

**Adam Hinckley.** And beyond matching SoloView: is there anything you wish the pick list had that SoloView doesn't give you today, on paper or on screen?

**David Smith.** On screen would be awesome if it showed amount to pull but also the inventory that we should have. That way when they are looking for an item that they need 12 of but can't find and the inventory shows them we have 1200 they are just in the wrong place. Maybe even as a pop up option if needed.

## Who does what

**Adam Hinckley.** Who runs Calculate and Release day to day, office or warehouse?

**David Smith.** Mostly office.

**Adam Hinckley.** On the iPad, is it mostly pick and pack, with someone else hitting Ship (and creating the invoice) when the pallet is ready?

**David Smith.** Correct.
