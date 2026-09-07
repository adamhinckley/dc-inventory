# Adam Hinckley and David Smith

**Date:** 2026-09-07
**Source:** Google Meet (in person, one machine; cleaned). ASR doubled a lot of lines while both were in the room.

## Setup and the two apps (0:00)

**Adam Hinckley (0:02).** I have the wholesale site and the internal site stubbed up. They connect. I stole the existing layout and did minor fixes — same homepage picture with the pumpkins. I'm calling the two pieces wholesale and internal. Back office vs customer-facing. Same dummy email and password on both. That user is a super-user. On wholesale you pick which customer you're ordering for. There's only one in there now. I want to see how you actually place wholesale orders, because what I stubbed is bad. You can see products and place orders. I imagine there's a better way.

## SoloView purchase orders (4:24)

**Adam Hinckley (4:24).** Walk through what you do in here.

**David Smith (4:24).** That's purchase orders. You search. We normally don't have more than 15 or 20 in the system at the same time. Unless I'm looking for closed, then I get thousands.

Pending are like you haven't sent it to the factory yet. I think pending is one that has been sent and is not building yet.

**Adam Hinckley (5:33).** This one that says open.

**David Smith (5:33).** The open ones are a draft. That's one that has not been technically issued. I can go in and hit Issue PO. I can unissue it.

Item codes start with DC. This factory is mostly decor. If I type DCDE — we assign that — and tab in an open field, it gives me all the products from this factory.

When I'm doing purchase orders, 90% of the time I fill one out on every single item that exists from here. I can tell it to show discontinued, or all vendors' products. Sometimes we drop a factory because they're not delivering quality or on time, but we need an item from them. I'll add somebody else's product to this purchase order. I have to send that factory a sample and change factory codes. It still populates with our item number, UPC, and description. Their information will not be correct. The factory will not know what we're talking about. Sometimes they issue a new manufacturer item number.

Where I really get the information is because I add one of everything. I don't know if we sold it until I show extra detail. That tells you we have 40, we had 10 sold, if they're on a purchase order, what we're paying. I wish it told me more of the rest. It will tell me month-to-date, year-to-date, last year sales, and all sales. This is a newer factory, so it doesn't have all that. You can also pull factory information on the item itself when you're not on a PO.

I don't need that one. I'll zero it out. Save. Then issue.

Usually I create a PO number. It doesn't do that automatically.

**Adam Hinckley (9:51).** I have this set up so it generates them. IDs for purchase orders, sales orders, customer numbers, factory numbers. When you see the number you know what it's tied to. Purchase orders prepended like PO- and then 00001.

**David Smith (10:23).** We never use shipped-via. All of our stuff is ocean freight except samples, and we have a particular system for that outside SoloView. I never issue a message to somebody on it.

This factory is Fujian Henfa. I think their item code is HF. So I give it PO HF 27.

**Adam Hinckley (11:02).** Would you prefer the purchase order number identified the factory?

**David Smith (11:02).** I like that. Some people do the first three digits as the factory code, dash, then unique numbers. Either way. This was easy for our warehouse. If a random box gets put somewhere, they look at the PO number and tell which factory it goes in.

**Adam Hinckley (11:34).** We can make that work.

**David Smith (12:03).** This was an add-on. A customer asked for these items. I can put lead time. If the factory says 60 days to make this, we put 60. You can put that on the factory in general.

**Adam Hinckley (12:03).** Does lead time mean delivered here, or they're just done making it and then it ships?

**David Smith (12:03).** Done making it. Then original ship date, revised ship date — once we get a booking it depends on the vessel, it's never exact — actual ship date, transit days because they vary wildly. Could be 38 days from that port to Savannah. Then ETA. That's one of the better things. It saves a lot of customer service.

## Wholesale site: colors, ETA, carts (13:00)

**David Smith (13:00).** A customer looking for Halloween ribbon: green means in stock. Orange means out of stock. Down here, this ETA — that's from the purchase order. We change those when the factory actually ships.

Red means sold out or discontinued. Out of stock means if you order it's just going to take longer. Like something for spring we sold out of but we'll have again next spring.

If they order something that's the infinity thing, that becomes data to build a purchase order from. This would not be infinity because this is already on purchase orders coming in. We can't change those. Infinity would be in spring. I think they just turned it off. Now it has ETAs for new items. This would have been infinity until last week when we placed the purchase order. Once the PO is placed we set it to sell out, to go with the original formula: purchase order plus on hand minus whatever we've sold is still available to sell, so we don't oversell.

**Adam Hinckley (14:56).** I've got that hooked up.

**David Smith (15:27).** Instead of customers calling "when is this coming" on 10,000 items, they go to their own order on the website. Previous order history. This is a cart I started. It stays until I place or cancel. In stock / sold out might change. This one's sold out. Can't add it anymore.

**Adam Hinckley (15:58).** If you try to place the order while these are red, does it say remove those, or what?

**David Smith (15:58).** It'll place it and those will just fall off.

Customers can see all of their carts. They can build as many as they want. I kind of like that. This part is the only real functional part of SoloView to me. The only flaw: you can't do it mobile. It will not switch to portrait. Even on a giant phone you see a little bit and you can't get all the way down the navigation.

## Adam's wholesale stub on a phone (17:00)

**Adam Hinckley (17:00).** Pull up the email. Open the wholesale link. It should look almost exactly the same as your wholesale site, but it actually works on mobile. I took the contact form off the front page. I haven't tried internal on mobile yet. The bottom image with the vase and social links on top of it wasn't working at different screen sizes, so I took it out. Social links are still at the bottom. I don't have a way to make multiple carts.

## Product images, SKUs, Faire (20:36)

**Adam Hinckley (20:36).** On desktop they show in rows and columns. On mobile I have no images. I hope we can script existing images and link them — from Shopify ideally — so nobody manually puts thousands of pictures on.

**David Smith (21:35).** Shopify and SoloView, most inventory systems: this is the actual item number. DC16171 green — that's what we have to name the file. Multiple images are dash 2, dash 3, dash 4. Different angle, lifestyle, cutout, colored background.

**Adam Hinckley (22:07).** Do you do variants — same thing, different color — or everything has its own item number?

**David Smith (22:07).** The GN part is for green. We had this in brown and orange. The last two letters are usually color code. We may have 12 DC16171s: GN, OR, YL, RD. As long as you can put the numbers how you want and they don't overlap, the software is fine. Hopefully it checks that you're not making something that already exists.

On Faire we do SEO descriptions with AI, multiple images — lit up, not lit, cutout — and video, which helps a lot. Faire and Shopify have that. SoloView does not. They host the video. They're getting commission, like Amazon, and they want you to run ads. B2B only. Credentials to get in. Gift shops and boutiques, not screws and bolts.

## Resale certificates / sales tax (25:31)

**Adam Hinckley (25:31).** They have a wholesale certificate so they don't pay sales tax. Do you validate those or trust them?

**David Smith (25:31).** We pretty much trust them. It can get you in trouble only really in Alabama, only with customers in Alabama. We get certificates for everybody because theoretically Tennessee could audit. I've never heard of another company in our industry audited that way. Alabama audited us and a couple of customers had relinquished their sales tax number and didn't tell us. We try to get new ones every year if we can. We're supposed to have a file image. Email, fax, or mail. SoloView just taking a number would technically be sufficient.

**Adam Hinckley (26:57).** It would be amazing if that checked the state's website. Depending on the state you can do automated checking. Not all states. Recheck every quarter or six months. The others are manual. If we get a weird feeling we'll call.

**David Smith (27:23).** Some stop turning in sales tax, dissolve the LLC, still buy from us, sell cash out of the house. Then we get in trouble in Alabama. The wholesaler is responsible for the tax even though we don't turn it in, because we're selling to people who are supposed to.

## Building POs from pre-sell; why SoloView (28:49)

**Adam Hinckley (28:49).** When customer orders are placed pre-purchase-order, does SoloView make it easy to build a PO off those numbers?

**David Smith (28:49).** What I did: add one of every single item from that factory. Some factories we may have 500 items. I don't know which we've sold. I check manually line by line. I hate it. It functions. Infinity selling and the formula — those are necessary. That's why we're still on SoloView. We couldn't find anything else to do those and release orders the way we do. Pre-order seems uncommon. There are four skyscrapers in Atlanta that are wholesalers like us. Atlanta gift market is one of the biggest. You can't find software that does the formula.

There was another one sales reps in the building built and sold. When BlackRock bought the market center in 2020 they bought that software too. They messed it up. They changed America's Mart to three different names. We got out. Rent was astronomical, plus labor and internet. 50,000 retailers, Macy's, TJ Maxx, Walmart. They unionized the docks. Nightmare to get anything in the building.

## What else SoloView must do (33:05)

**Adam Hinckley (33:05).** I think I have a basic understanding of purchase orders. What else is important that the new stuff would have to do? Conceptually: purchase the product, log inventory when it shows up, ship to the customer. Plus customer information — billing, shipping, contacts, credential with the state.

**David Smith (33:37).** Customer information is straightforward. Tons of tabs. Some we use, some we don't. Address, email, billing, contacts. It lets us assign a sales rep. We don't — my dad's the only sales rep and we know who his customers are. Theoretically we'd add people in different parts of the country and track their sales. Notes: who called last and what they said. Details has way too much we don't use.

The payment processing side — I think we have a workaround. We're sending most people payment links.

**Adam Hinckley (35:38).** Do you want payment processing in the product, or prefer it separate? Stripe or something.

**David Smith (35:38).** It's good for it to be an option. Customers who are running their own small businesses call: I need a hundred garlands, send those. We get it ready, send a payment link, knowing they're good for it. Then they never do it, don't answer. If we have their card I just run it. Useful. Not ideal.

These are their orders. We can go back however far. Custom pricing — we don't really do that. This is billing: how much they owe and how long.

**Adam Hinckley (36:56).** Can you grab a screenshot of that and email it to me? Accounting is one piece. I have a page stubbed. High level: how much we paid for inventory, how much we charged. Maybe someone never paid. I don't know what all your accountant needs.

**David Smith (37:25).** This is a good customer. Almost all of her orders are finalized — that means paid. These she owes us for: shipped or picked up. Invoice current. Pending request date means we haven't shipped — spring order, ship 2/17. Recently past due — we probably invoiced a little earlier than she got it. She'll call and give a card.

Accounting adds those up: this is what she owes right now, open balance. She wants to put $5,000 on the account — we put $5,000, it deducts toward the oldest. Or a payment plan. She's one that will say put $1,000 a month on the card.

**Adam Hinckley (39:14).** So she has credit with you. Do people ever put money you hold like a tab they spend against?

**David Smith (39:42).** Basically a credit limit. Some people can only spend this amount because if we get over it they're never going to pay. We've tried to get away from a lot of this. Usually old customers we've known forever. Newer customers: all credit card.

## Warehouse, order release, pick (40:40)

**Adam Hinckley (40:40).** Is warehouse like inventory?

**David Smith (40:40).** Warehouse is inventory only in that you can adjust inventory from here. It timestamps and tells you who was logged in. This pick-check thing they were supposed to be building did not work.

This is order release. These are orders placed previously that have not shipped. 335295 BO — probably a $100,000 order that got split off. It will tell you we have 100% of this in stock. Ship level: we only have 12% of this, 71% of that.

**Adam Hinckley (42:07).** If there's 100 items, 71 of them are in stock?

**David Smith (42:07).** I think it goes off of dollar amount, not quantity. I'm pretty sure. They wanted this shipped July 1st. We have 71%. Notes on the customer will say they decided to wait until September 15th. There's $898 of the $1,257 order. Payment: these are credit card, this one can pay November 1st, this one has to pay by check, this one has 30 days.

**Adam Hinckley (43:43).** Do you do more than net 30?

**David Smith (43:43).** 30, 60, or 90. Custom date. In our industry a lot of people give November 1st or December 1st — Christmas stores buy millions and pay after the season. We don't do a lot of that anymore. One customer is 30/60/90: 33% / 33% / 33%.

You click the ones we can calculate. It fills these orders based on all inventory. Once it calculates this one it may change the number on that one, because two people ordered the same item and we don't have enough. It puts it on one. That's why we hit Calculate, then Release. Release prints every pick list you asked to release.

**Adam Hinckley (45:54).** PDF, or it just prints?

**David Smith (45:54).** Both. Saves a file and automatically sends it to the printer. Orders change to pick in progress. Not an invoice yet. We sent it to the warehouse to get everything on the pallet. Limbo. Once it's pick in progress it's like a separate inventory, a different location almost.

This is why I wanted to come down here. There are lots of things like that I'm not going to infer.

## Item snapshot (47:10)

**David Smith (47:10).** Snapshot is what I look at most of the time. They come 24 in a box, $2 apiece. If you buy 240 — master case — you get 10% off. 737 on hand, 48 on order. Being picked would be a separate number, deducted from on hand.

Here's one: 106 but 12 are being picked, so open stock is 94. Same idea as available to sell: what's committed, what's in stock.

I like snapshot. It's KPIs. I wish it had bar graphs — where is this selling, who's buying it. It tells you we sold 125 this year, 602 altogether. Pending POs, PO count — if it's on two purchase orders it just tells you two, which I think is ridiculous. Total quantity on the POs here. If 1,200 are coming in, available to sell goes up 1,200.

Details: unclick sold out. It auto-discontinues when sold out. If I click never, that's infinity mode. You can put as many as you want. Once we go through purchase-order season we email SoloView and say change it all back to sell. We can't bulk edit anything. They can on the backend. In Shopify and Faire we can.

## Infinity by season, staff override (50:36)

**Adam Hinckley (50:36).** When you're doing purchase-order season I imagine a block — Christmas — here's the date it opens, here's the date it closed, and as long as it has that category it's infinity for that window.

**David Smith (51:32).** It works in theory. Problem: products we do not want to sell infinity. We're not buying from X factory anymore. We want everything to run except that factory. If you had a toggle on each product — this one can do infinity, this one can't — then bulk edit Christmas, see it all in one table, click a row, modal, adjust, carry on.

When I work with customers, especially Christmas, I'm on an iPad and I have the laptop with SoloView back office. Big customer: we really want this item from last year. We discontinued it. Can you get it? I have to set it to infinite quantity and put it on their order. It would be great if I had an override on the selling side. David is logged in and David can do whatever. If it's just the customer on their account, no.

That happens quite often. Somebody wanted items two years old, 3,000 of a color, now I have to run it again.

**Adam Hinckley (53:48).** Do big customers log in and place their own orders, or is it usually you?

**David Smith (53:48).** Occasionally. Most is us. It's important to keep both.

If somebody calls — SoloView's website isn't great on a phone — they say I'm on your retail website, I want this, this, and this. We go to them as a customer, Orders, New, type the item number and quantity. Fast entry because it's faster than the other site.

**Adam Hinckley (54:59).** For fewer bugs, one way to place orders. Wholesale site only, at least for version one, as long as it's really easy.

**David Smith (55:41).** I think that's fine. The reason I use back office sometimes is override. If I'm putting an item we're sold out of, I can still sell it.

**Adam Hinckley (56:09).** I'd make you intentionally turn that on and double-stamp it. Before you send: are you sure? This is not inventory. We're turning on infinite ordering. Make it obvious.

**David Smith (56:42).** Inventory with that many items is never 100% right. We have items that are not in inventory and I need to sell them. SoloView will not let me on the website. It goes discontinued. I hand-write in the warehouse, count them. It would be great to add quantity to in stock without following the purchase-order trail. Elevated permissions.

**Adam Hinckley (57:39).** Do warehouse people have logins that let them do their job but not everything, or do they just look at paper?

**David Smith (57:39).** They pretty much have access to just about everything. There's not a lot of permission granting in SoloView. I would love cycle counts on an iPad instead of printing inventory by factory, writing 144 next to 120, then somebody manually enters it. If the change is over a certain percentage of inventory, flag it, manager verifies, PIN to allow the change.

The only people who really have SoloView access are people who know what they're doing. Everybody else is paper.

## Reports, history, Shopify Plus scar (1:00:06)

**David Smith (1:00:06).** I can pull all kinds of reports from purchase orders, sales orders, everything sold. Product reports, types of customers.

This one's outdated. If I hit update it'll take 10 minutes. Today you sold this many orders. Month to date: 142 orders for $100,000, average $77. Up 17% over September last year, up 14% in dollars, down 3% in average order. It emails me a copy every night.

**Adam Hinckley (1:01:46).** Can you get a spreadsheet? Whatever you transfer over, you'll want history. An import of your history that works is the thing that makes me most nervous. Statistically a lot of ERP migrations never finish.

**David Smith (1:02:26).** We tried Shopify Plus. That's the pushback I get. Jennifer's a little gunshy. She and Matt were on the phone. They said we can make it do this, customizable. Year contract. They wanted two. About $2,000 a month. Better shipping and card rates. We were doing a million on Shopify. It wasn't really a wash. It gave Jennifer a bad taste: people say they can do stuff and then they can't.

The problem: they said they could house credit cards and charge when the order shipped — that became a nightmare. And they could not run the formula — PO plus on hand minus sold — and set some items to sell infinitely. We paid a guy in England on Fiverr. He said you could do it a year ago, they changed the code, they won't revert. He refunded us. Shopify cut the contract short. Nightmare.

As long as it does that and we can drop history.

**Adam Hinckley (1:06:26).** If you switch off SoloView onto a clean slate from zero, does that break things? How important is all your customer history?

**David Smith (1:07:01).** If it was possible without stuff broken — customer A looking like they ordered customer B's history — we'd probably do early to mid December. After that we start seeing customers for Christmas next year. We don't want those new orders on SoloView. Spring would be the fewest pre-orders. Those we'd have to dump into the new system. We wouldn't have the massive Christmas pre-order book. That's the easiest time: fewest unfulfilled orders.

That's a difficult commitment for me for this year. You could do it later. If we had to pull all the spring pre-orders off and manually enter them, January 15th is months of work. Too much stuff, risk of getting screwed up.

We try to pull data from SoloView every now and then because we don't trust them. They've been hacked twice. Microsoft stack, their own servers, remote desktop, redundant box. Antiquated. Ransomware, they wouldn't pay, dump servers, two or three weeks down. Happened to us in September one year. Nightmare.

**Adam Hinckley (1:12:17).** Neon has 30-day point-in-time recovery down to the minute. A lot of the stack is managed. Not crazy expensive.

David's people are optimistic-skeptical. If we never flip the switch, $12k spent. He was days from signing NetSuite. Sales quota pressure. Reference customer in California on a private server: they count every line item as a transaction. Thousand-item orders would blow the monthly cap, another ~$3k/month. They never said that on the calls. He walked.

## Internal app walkthrough (1:16:13)

**Adam Hinckley (1:16:13).** Drive around internal. Same fake username. Dark mode follows the system; you can switch it in the account. I need to clean up dark mode colors. Button text should be white to match the other.

Customers: list, click in, tabs, credit limit, terms at the top.

**David Smith (1:17:51).** Can you create sub-accounts under a customer? Some customers have multiple stores.

**Adam Hinckley (1:17:51).** Under ship-to and bill-to you can have a different address for each store, different billing. That's one way.

**David Smith (1:18:22).** Right now we technically have them as separate customers in SoloView.

**Adam Hinckley (1:18:22).** Blank slate. As many ship-tos and bill-tos as you want. Contacts however many. Certificates — wholesale license. I don't know if that's the right name. Documents, certificates.

I placed a handful of test orders. You can cancel or ship from there. Breadcrumb or back to main.

**Adam Hinckley (1:19:50).** I need to fix a bug in the breadcrumb. We were on customers. You clicked a sales order and it kicked you into the sales page and reset the breadcrumb.

**David Smith (1:20:33).** Confirmed order. Eventually columns: order number, ship date, dollar amount.

**Adam Hinckley (1:21:08).** That information is in the data. It's just not showing in the UI. Cleanup on input sizes.

Purchasing: drafts that haven't been submitted. Columns: what's on PO, on hand. If you need 187 and it filled 216 — 6 × 36 — it's rounding up to case.

**David Smith (1:22:10).** That's exactly what you want.

**Adam Hinckley (1:22:10).** Uncovered — horrible name — everything ordered on the wholesale site in open season that you need to order, by factory. Click in: what I need from that factory. Save draft or let it continue to build. Agnostic: not who ordered what, grand total across customers. One factory at a time. I assumed POs are always one-to-one per factory.

You can bump a number to have more on hand, then finalize.

**David Smith (1:23:57).** If I try to order a quantity that is not a case quantity, is it going to kick it out?

**Adam Hinckley (1:23:57).** Probably not right now. Do you want it to?

**David Smith (1:24:27).** I would like that. At least warn me: round up, make sure I'm meeting case quantity. I'll inevitably type a number. In SoloView I have to go through tabs to see case qty, picture, sold and pre-sold. Then the factory emails: can we make this this number because it's not full carton.

Finalize, then receiving when it shows up. Validate what showed up. Receive what you got, cancel the remaining, pulls it out of inventory counts.

Sometimes I place one purchase order from a factory that's 10 containers. They come in at different times. Partial. Remainder needs to stay open.

**Adam Hinckley (1:25:46).** Receive 700. History: September 7th I got this many. Back to lines, receive another chunk. Another history line.

**David Smith (1:26:14).** That works.

**Adam Hinckley (1:26:14).** One receiving button or one per row? Couple hundred lines. I imagine someone on an iPad, line by line, rather than a button at the top that does everything.

**David Smith (1:27:17).** Cool to have one that did everything. Occasionally we get one container, they've checked it off, hit everything's here. Bulk: top checkbox, receive all at once.

If they're shipping two or three containers we get a packing list per container, different ETAs. It would be great to have container number, master bill of lading, even vessel name. A guy kept trying to sell me a tracker that pulls ETAs.

**Adam Hinckley (1:28:24).** VesselFinder. I could look into what it would take.

**David Smith (1:29:56).** SoloView only lets us put an ETA. We find the vessel, get an ETA, put it in manually. Fine. Cool if you didn't have to.

**Adam Hinckley (1:29:56).** Goal for v1: do everything SoloView does first. Weed in other things if they're really low-hanging fruit. Then talk about new features.

**David Smith (1:30:21).** When we get an order with 10 containers we usually split the purchase order up manually. It would be great to check certain items, bulk them, assign a container. Between purchased and received: notification a container went out, this is everything on it, assign it. Whatever hasn't shipped stays pending. Three containers on the same vessel, same ETA, still one PO, line break, group. Click the container, receive all. Very rarely wrong on a container from China. India is a different story. From China 99% of the time it's 100% right and we just receive it. Three containers the same day: receive, receive, receive.

## Inventory, sell state, catalog (1:33:19)

**David Smith (1:33:19).** Accounting is empty. Reports is empty. Sales is sales orders from the wholesale site. You don't place anything here.

**Adam Hinckley (1:33:57).** Inventory — I think I have the numbers you want. Nothing in the warehouse in this demo. ~3,000 products. 100 rows per page. Filter by factory, search SKU or name.

Sell state: when you're in open season, Open means you can order infinity. I need to work sell state. Manage pre-sale is a hot mess. Turn on Christmas, open season — 3,384 products, infinite scroll. I haven't wired a way to turn it off. I need a convenient way to turn infinity on and off for a block of products.

Catalog is everything you have. Not inventory. Edit product, inactive or discontinued.

**David Smith (1:36:45).** Beneficial in this field: case quantities and discount level. For the most part case quantity is the discount level. Some items are pack one; we don't discount for one. We make up a number, three or four, that's the discount level, 10% off.

**Adam Hinckley (1:37:28).** Import is what I used on the CSV you sent. That file didn't have unit costs for some items. Make the file as clean as you can. I need to clean up import. Columns to add: weight and measurements. I think they're in the spreadsheet. Categories aren't accounted for. There's like 10 descriptions or categories, a tree.

## SoloView category tree vs Shopify (1:39:01)

**David Smith (1:39:01).** In SoloView, management, product browser — this dictates to the website where something goes. Category, parent category, tree view. I don't know if that's necessary. On Shopify we put stuff where we want. In their system you can only build exactly as it is. Squares, you can't make anything bigger, can't change the font. That's all we can do that's unique.

**Adam Hinckley (1:41:51).** Custom order forms is what I did in my last job — a whole editor. Five-year project. Doesn't have to be like that. How do you get the fall pumpkin pictures on the homepage?

**David Smith (1:42:22).** I'd have to ask Summer. She does that.

**Adam Hinckley (1:42:22).** It wouldn't be hard to say these images run until this day, then switch the season. I don't know how much this matters. I assume it does because it's there.

**David Smith (1:42:56).** If the rest of the site was better, it wouldn't be that big. Shopify lets us change fonts and build sections like an email builder: header, divider, image.

**Adam Hinckley (1:44:08).** I built a system like that for ClickBank. We could do something like that. It probably won't rival Shopify short term.

Conversation about Shopify's origin, CommentSold (Huntsville boutique → ~$50M), and selling pre-order / "how many do we need to buy" to retailers. Same pattern as their infinity book, with T&Cs that they *can* charge if goods arrive and the customer doesn't take them — they mostly don't; it's anti-scam. Don't take money until it's okay to ship.

## Commercial: partnership, pricing, sellability (1:51:17)

**Adam Hinckley (1:51:17).** I'll take a stab at accounting. Shoot me that screenshot. We've talked about handing you the keys once it replaces SoloView. Another idea: front-loaded piece to get over the hump, that work is equity, I keep building, maybe you sell it.

**David Smith (1:52:26).** I think I could sell it. Once you start selling, more work. Pricing: SoloView charges per add-on. SKU tiers — 500, 1,000, 2,500, 5,000 — like an email list. I believe there's a way to sell it to retail if you can scan into a cart. Hook a card reader and receipt printer and you're competing with Square. Pre-order is a huge need. Retail people won't spend $2,000/month; they might spend a couple hundred. Hard to get people off if it's functional and friendly.

Planning now matters. Once you have a year of history you're locked.

Softr-style "no developer" tools: David tried a free trial, got ~70% of a paragraph of requirements. Thin ice to sell multi-tenant without someone who knows systems. Gift-market buyers are not that technical. If it's easy they stay.

He could sell enterprise to ~15 current customers at his scale, plus walk Atlanta and Dallas — he grew up in those buildings. Shopify Plus is supposed to be wholesale and doesn't do infinity. Billion-dollar Plus brands have custom teams, not the same product.

A New York friend (~$50M, EDI for QVC / Kirkland's) has no API to Shopify / Amazon / Walmart / Target / Faire. Missing ~$2M/year on Faire because every $100–$200 order would be manual. They forced a dual old+new backend for people who wouldn't switch.

**Adam Hinckley (2:06:55).** I need homework on Shopify. I made a developer account. They don't have an MCP that just makes it work. I can hook it up. I don't have the details of what SoloView and Shopify are doing. I'd need to log into your Shopify developer side. Not today. Shopify integration has to happen after the base.

**David Smith (2:07:55).** We've had the Shopify integration four or five years. They broke it multiple times. Virginia, once a week, checks it's still talking. REST now; new integrations have to use GraphQL.

## Money, pace, dual-run (2:09:48)

**David Smith (2:09:48).** I can give you money. Jennifer's gunshy about paying more upfront. I want it to be worth your time. I'd love to turn it on and cut a large check.

**Adam Hinckley (2:10:51).** Along the way, cover expenses. I'm probably $400 on AI. I bought this computer — I don't need you to pay for that. I'm invested. The more I spend on AI the faster. Newer models I'm not using because of price. $1,000 a month I can get results faster, agents in the background while I'm at work.

**David Smith (2:17:07).** I'm okay taking the moderately slow route. We're functioning. I have things in the background taking too much time. A guy wanted to buy the business last week. I've been drafting NDAs and financials for two weeks. I don't really think it'll happen. I owed it to myself. 2019 flood six blocks from here — lost everything, borrowed $2 million, boxes stacked 12 feet crushed and wicked water. Financials weren't great until this year. Goal: close to debt-free by year end. Last year an extra $400k in tariffs; some refunded by classification. I'm not uninterested. I have more emails than I can answer.

**Adam Hinckley (2:22:12).** If I could get expenses covered along the way. Two or three weeks ago on a Saturday we talked about $500 a month. That would cover the AI bill as I've been working. I could turn it up. Send you an invoice? I tried to open a Chase business account. Placeholder LLC, DBA name change, they rejected until I had the state certificate. I got the mail today. I think I can send a payment link once the account is open. $500 a month unless we crank it up. Also my time outside the job.

**David Smith (2:23:58).** Maybe slower is okay, because if you ask questions I can't get back as fast as needed.

**Adam Hinckley (2:23:58).** Once we turn it on — real account, production, dad as a seller — you don't turn SoloView off that day. Run them side by side. Tweaks. Hang on a few months to pull old customer data. Attempt a data transfer. Spot-check 50: this is what it says in SoloView, this is the new system.

**David Smith (2:25:20).** I think we can export pretty much everything. Tree view is the only thing I know of, and we're not really going to use that.

## Images we own (2:25:50)

**Adam Hinckley (2:25:50).** Where are your images hosted? Through Shopify?

**David Smith (2:26:28).** I think SoloView hosts SoloView's. If you turn SoloView off you lose that. We have them in Shopify too. Three sets — Faire also. They don't all pull from the same bucket. Faire often has more images and video. Phone upload on Faire/Shopify is useful. SoloView makes you name the exact item code or it kicks it out.

**Adam Hinckley (2:27:33).** We can rename on upload, convert HEIC.

Google Shopping now 500×500 (was 250). Faire 600×600. Shopify is probably the easiest to tap by product ID, including video. I have a placeholder in the data. Might make sense to own our own and push out. Problem for another day. Summer and Jennifer deal with Shopify more than David.

ChatGPT ballpark: 4,000 × ~1MB images is cents to a dollar a month storage; bandwidth is the variable; serve 100–500KB derivatives.

**David Smith (2:54:08).** If you get me a spreadsheet that has a link to all of them, I'll see if I can get it.

**Adam Hinckley (2:54:45).** Then they show on the wholesale site. I need filtering, categories. Right now it's show me all active products — almost 4,000. Nobody buys what they can't see.

## Infinity UI again (2:32:01)

**Adam Hinckley (2:32:01).** Did we talk about how to turn infinity on and off in a useful way? Manage pre-sale is a bad name. Category you sell by season. Christmas window, another block for spring. Import is not retaining categories. A hundred columns, you use 20. Variants matter for other tenants later — clothing sizes, flavors — we never really dealt with it in wholesale.

Filter category, table populates, beginning date and end date, set ahead of time. Competitors say you can pre-order until this date, or start this day. Build a cart but maybe you can't push order yet.

**David Smith (2:36:39).** I'll work something out. I need to fix the import so it retains categories. There are like 10. Some products have multiple. Same as the tree. Christmas, and a theme, and pearl spray, ornaments, ribbon, garlands, wreaths, stems. We've never wanted more than 10. Nested filter: Christmas, then children.

For infinity, for the most part we turn on Christmas. If you discontinue an item, even if you turn on the window, it wouldn't add that item. We already have discontinued. SoloView considers it auto-discontinued as soon as there's zero to sell. That's dumb. That's the only way they know not to oversell. Another Atlanta company on SoloView never lets anything sell out — infinity forever, they just PO when they hit a quantity.

**Adam Hinckley (2:40:54).** During the season, multiple POs to one factory, or wait and one bulk?

**David Smith (2:41:28).** I usually try to let it build to one. Sometimes multiples. To beat production season, in December I'll buy some fall and pumpkins we need earlier than Christmas. 90 days to produce, order February 1, you're late June / early July. Customers want fall as soon as May is over. We'll buy some stuff blind. We still leave them on infinity. If I order 1,440 of a berry and we oversell, I order another set with Christmas to come in late July / early August.

Very few, but this year we sold a full container to a customer. Never comes into our warehouse. Separate PO. Charleston straight to their DC. Factory didn't load it right or early. She discounted 10%. They left half of two items off, put them on our containers, late. I'd like to do more of those.

## Close (2:44:43)

**Adam Hinckley (2:44:43).** This has been really helpful. Chase Tuesday or Wednesday if the account opens. I'll drop you a proper invoice for August. I'll carry on. I don't think I can have something workable to cut over at the beginning of December.

**David Smith (2:45:43).** I wasn't imagining that. After that there's no possible way until late spring, after Easter. Run dual. Do you know if customers ask for things on their end?

They like that Faire has a native Shopify integration. They buy from us, set markup, dump images and descriptions into their Shopify. Or they want a file of every image they just purchased. I'll ask Jennifer. I've never done that piece.

**Adam Hinckley (2:48:19).** SoloView parity so you can get everything SoloView does. Cool stuff on top of that. I'll see if I can pull images. Export from SoloView as one chunk?

**David Smith (2:48:52).** I don't believe so. Shopify exports hyperlinks, not the files. I don't think you can export them from Faire the same way. I can get a spreadsheet with a link from Shopify or SoloView. Then you download and re-upload to a source we own. I don't think being married to Shopify for images makes sense.

**Adam Hinckley (2:55:10).** I'll end this. Accounting I'll have to spend time on.
