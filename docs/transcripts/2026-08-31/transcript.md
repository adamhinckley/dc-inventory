# Adam Hinckley and David Smith

**Date:** 2026-08-31
**Source:** call transcript (cleaned)

## Member price and MP (start)

**Adam Hinckley.** Okay, that's on. We'll come back to that though. What were you saying about this piece?

**David Smith.** I was saying I don't recognize the member price. That's actually, I think, what we sell it for.

**Adam Hinckley.** This PO cost?

**David Smith.** No, not the PO cost. I'm not sure what the member price looks like, what we sell it for.

**Adam Hinckley.** Okay, there it is.

**David Smith.** I think it's correct. Yeah, that's got to be what we're…

**Adam Hinckley.** MP. So it's assuming price log, I'm guessing.

**David Smith.** MP price is master pack price. So there's inner pack price and master pack price.

**Adam Hinckley.** Where does it say price in here? Hopefully it can just highlight where it says price. I'm not super good at spreadsheets.

Cost. So I had it go through and try to assume what every one of these columns means. And I have a document for that that I wanted to show you.

**David Smith.** Yeah, sure.

**Adam Hinckley.** I'll send it to you instead of going on the call. The member price might be what the MP price is. And I just assumed that's what it meant.

**David Smith.** I think that's what that is. It's supposed to be like master carton price.

**Adam Hinckley.** I'll find that document and shoot it to you in Slack.

## Catalog columns: on hand, pre-sold, need, case pack

**Adam Hinckley.** And then what were those two columns you wanted to have added here? It was on hand.

**David Smith.** Yeah, what you have on hand of an item and then what you have sold of an item. I think it'd be cool if it just had on hand versus pre-sold equals your negative, like you need.

**Adam Hinckley.** This is how much you need. And then if it just automatically filled in how much you need in these inputs?

**David Smith.** Yeah. If it would take that number and give you the closest master pack case quantity to that. So it's like you need 600, but the closest thing you can buy to that is 584, whatever that number is to get you above what you need, but then divide that by the case quantity that you're going to have to buy. Does that make sense?

**Adam Hinckley.** Yeah, I think so. If it looks right next time I show you this, we'll know if it made sense. I think I got it, though.

## What the system has to do

**Adam Hinckley.** And so purchase order, get it from the factory, bring it into the warehouse, and then mark it off as shipped, and then have a log of history so what happened last year and in perpetuity. Does that cover everything this needs to do at a high scale? Obviously there's minutiae in there, but

**David Smith.** Yeah. That's pretty much it. Purchase orders, bringing it in, using that software as a source of truth for the inventory numbers and the cost, and then it ships out. So those numbers outflow from that. And then basically that's what our accountant takes. There's a GL report, basically. It pulls that, says you sold this many items at this dollar amount, and it's just a basic number. It's not line item gains and losses.

**Adam Hinckley.** What does GL stand for? So it's the same thing as a P&L?

**David Smith.** No. It's really just an easy report from an inventory stance that basically says you sold X number of items and you took in X number of dollars and you paid X number of dollars for it. So it basically gives the accountant different numbers. It's saying you took in $10,000 on 10,000 items, but you paid $4,000 for those. So your gain is $6,000 on what you sold this month. She pulls those twice a month. You can run it every day, but she only runs it usually twice a month to pull this gains and losses number that will just basically tell her we moved this much inventory out of the warehouse, and it will tell her this much money came in and what our cost on that was and what we took in off of it.

**Adam Hinckley.** And she logs in and grabs those herself manually.

**David Smith.** Yeah.

## Accountant login and QuickBooks

**Adam Hinckley.** So one of the features that you could totally hook up, more time and whatever, but if she's using industry standard accounting software that can talk to an API and just be like, hey, pull this from this account.

**David Smith.** Yeah, I mean she's logging it into QuickBooks.

**Adam Hinckley.** I'd imagine QuickBooks has a way to integrate so they can pull numbers from stuff.

**David Smith.** There are lots of other systems that do integrate.

**Adam Hinckley.** That's something that's probably not that complicated to hook up. If they've got documentation for what they need, we can make it so that it registers as she's the one with permission to go in and get it. And that's a polish feature though. We can give her a login that's just the accountant role that just shows what she needs. That's going to be first thing we do. But if this turns into something that we're selling on a larger scale, it's probably a feature people would want.

**David Smith.** But yeah, it looks fairly user friendly.

## Screen size

**Adam Hinckley.** That's the goal. And this is on a 13-inch screen. So when you saw me scrolling on the table…

**David Smith.** I use a laptop, but I hook it up to a monitor in my office.

**Adam Hinckley.** So on your big monitor you're probably going to be able to see all of these without having to do the horizontal scroll.

## Commercial terms discussed, not agreed

**Adam Hinckley.** As far as a cost for this thing, is it reasonable to you for it to be to front-load it, turn everything over to you, you own the whole thing outright, and then you can let me back in later to help if you want to, and that's your decision.

And then we could talk, and if we do it that way to start, I'd want to have an agreement like you don't run off with this software and build something and leave me out of it.

**David Smith.** Right. I mean, what's wrong with me building a multi-billion dollar software empire off what you build?

**Adam Hinckley.** Obviously there's a lot that goes into the vision of that.

**David Smith.** There's got to be some mutual trust on lots of different levels. Putting some things into writing, I'm cool with accountability on how that works.

**Adam Hinckley.** Then do you think what SoloView costs for a year is a reasonable price to get this thing all working, turned over to you, with an agreement to maintain any sort of not new features but something that's supposed to work isn't working like it's supposed to, come in and fix it. But that's just built into the whole thing. It wouldn't be an extra fee for that. Then if you wanted babysitting, monitoring, on-call kind of a thing, we could work something out for that. But you probably don't need that.

Or if you have a hundred companies using the thing, you need people on call to deal with things and keep service up.

**David Smith.** I guess my question would be, is that most comfortable for you to do it like that?

**Adam Hinckley.** I think, what's your concern? I'm sensing hesitation.

**David Smith.** I guess I'm wondering, I don't know how long it's going to take. I know you right now have optimism that it's going to be shorter maybe rather than later, but I don't want you to have tons of…

**Adam Hinckley.** I got this done faster than I anticipated. So here's what I'm thinking. We put incentives in place. We do half at the beginning and then half at sign-off at delivery, when it's all yours and it's all signed off and we've done the white glove thing. That's when the other half, that payment, is what click turns it over to you.

And since I didn't know exactly what all was going to be needed, I got a much better idea now. A lot of the research has been done. The backend architecture is in place for everything that I described it needs to do. I just want to make sure there's not some piece that I'm forgetting. Now it's just a matter of hooking up what you see in the UI to the backend that already exists.

And I think I could have a working product done within two months, both from this one and the one that the customers would have to do. It could be much faster than that. That's me being like, something happens and I'm not able to dedicate 20 hours a week to it, which I think I can on top of my job.

**David Smith.** Okay.

**Adam Hinckley.** And it also makes it so I have some capital to get a much better machine to help me do stuff faster. I have a really juiced up machine for work, but I can't use it for this.

**David Smith.** Yeah, I get it. Yeah, if you don't mind, let me think about that for a little bit tonight and see if I think of any pitfalls to that or anything.

**Adam Hinckley.** And we can get something in writing that says this is everything it needs to do, this is what that is going to buy, and in my mind that number I'm pinning at $24,000 total, because you told me Solo gives two grand a month. That's how I'm arriving there.

**David Smith.** Yeah, I get that. I don't have any problems with that. I like to kind of bat things back and forth in my head before I agree to something like that.

**Adam Hinckley.** Yeah. Then I don't have that expense of SoloView anymore. And then you can decide to have me on a retainer if you want one where I'm always adding little things here and there. That's up to you. You also have the opportunity to bring on somebody else.

**David Smith.** Yeah. All right.

**Adam Hinckley.** Yeah, let me know what you think about that. I'll get those other little things put in and make sure that they work right. I do have a working version of this deployed. Everything's running on my machine right now. This is the deployed one. I made the name the business poll clear. This is the only thing I could find that wasn't already taken. You could do a subdomain on David Christophers if you wanted to, or a completely different name.

**David Smith.** That's great.

**Adam Hinckley.** So yeah, I have it working end to end. I know it works deployed. Do you have any questions? Is there anything I didn't think to ask?

**David Smith.** I don't think so. And if I think of something, and you were going to send me that…

**Adam Hinckley.** I'll send you that. Yeah, it's kind of like a glossary. These are all the things, this is what I think it all means.

**David Smith.** Yeah, it's kind of like an FTP. It's kind of a file paddling shift. So it's the same data. It's just this one's naming it this and this one's naming it this.

**Adam Hinckley.** I wanted to make sure, one of these files, there's all these things that are abbreviated and I just want to make sure that we're not misunderstanding what one of them is so the wrong numbers happen. So I've got a file that has all of these and then next to it this is what I think it is. I'll send that to you. You can look over it and if there's anything that's wrong, just call it out and we'll fix it. I'll work on that and get it over to you hopefully tonight. Let's see if Jody needs anything and if not, I'll be tomorrow.

**David Smith.** Okay, sounds good. All right. Thanks.

**Adam Hinckley.** All right. I'll catch you later.

Meeting ended after 00:16:30.
