# The owner's ideas for pictures and pages (September 27 and 28, 2026)

Three things from the owner, word for word: his notes file, the message he sent it with (which adds
the Gaussian splat toy), and his acceptance of the plan. The Operator's report in between is the
private page "Pages into Splats" (https://claude.ai/artifact/9mrrJYPiZKbSD9s5gFBpaA). It has a
legibility test on the real engine, the research, the toys, the Gaussian splat toy, the Tinkerer's
Manual and the plan. The plan itself is in ROADMAP.md, "Pictures and pages".

## The notes file (splashery-notes-2026-09-27.md), attached on September 28

> # splashery-notes-2026-09-27.md
>
> Alright, so one additional idea I have is something that I don't know if we can do, but maybe we
> can try it. I'd like to see if we can build it soon. Doesn't have to be immediately, but it's a
> pretty cool idea. I don't know if anybody else has made something like this. It would be really
> cool if we could do it. If it's not possible, then okay. That stinks, but if it is possible, I
> want to do it. We should at least think hard about it and try. So correct me if I'm wrong, but my
> understanding of what a PDF is, is that it is effectively a bunch of images in a file. Now, it's
> like a special way of formatting these images, and they can be machine-readable and stuff like
> that. You can have links in it. PDFs are a little different from images, but for the most part, a
> PDF page corresponds to, like a flat 2D sheet of paper, especially if we're talking about like the
> page of a book, or the page of a research article, or something like that, right? Well, I wonder
> if we could come up with a way to convert an image, or I'm sorry, a PDF page, or even an image—I
> think an image would be interesting as well, if we can do this—into a 2D flat plane. That's like a
> rectangle, or whatever the dimensions are, the aspect ratio is of the image or the page of the PDF
> file, but it would be a 2D Gaussian splat that is as close to a perfect replica of that image or
> page of the PDF as possible. I wonder if we can do that. Because if we can, and we can find a way
> to do it consistently and reliably for any kind of PDF, you know, page that we upload, or any type
> of, like, image file that we upload, or I guess, you know, whatever supported type is, like a PNG,
> JPEG, something like that. If we could do that, then I feel like it opens so many possibilities
> for things that we could do with this tool. I will name the ones that are the most interesting to
> me. You can probably come up with a bunch of others. The first one is allowing people to put the
> pages of a PDF, such as their own research article or their own book or something like that, into
> a virtual Gaussian splat book, kind of like our storybook, but you can actually flip every page,
> and each page is the proper corresponding page of the PDF that the person uploaded. So for
> example, if I have a research article that's like 10 PDF pages, then I can upload that, and our
> site or whatever will create a Gaussian splat, and this would just be like one of the toys. You
> can select this toy and then you can upload it. You can configure settings about, like, what else
> you want to be in the toy. Like maybe if you want, like, there to be, like, a book cover, if you
> want it to be a book, or, like, a magazine, or something like that. You can maybe choose how it
> looks, like if it's bound or something, but we could probably program this so that if somebody
> uploads a PDF of, like, a research article or a book or something like that, and I honestly want
> to support, like, an arbitrary number of pages. The quality might not be perfect, but if we can
> try to get it, like, really high resolution, even if it means that the book is, like, super big,
> or even if it makes it really hard for us to build it properly. I'd like to try. But the big
> example that I was thinking of is, like, if I have some arbitrarily large research article—let's
> just say it's, like, 10 pages, for example. Then I can choose, you know, upload your own book or
> article or whatever as the toy, and then I can upload the PDF of my article, or somebody else's if
> they give me permission, whatever. But if it has, let's say, 10 pages, then the site will
> automatically identify there are 10 pages, and then it will load this in and create a Gaussian
> splat for all of it by kind of, like, mapping from the pixels to Gaussian splats, colors and
> stuff. And it'll put it all in a way where you can actually flip the pages, so you have a virtual
> copy of your own research article or book or something like that. That's the first thing that I
> thought of that would be really neat, but there are actually a bunch of other ideas that are
> really related that are pretty cool as well, if not even cooler. Oh, and I don't know if we need
> to get permission from people to put their, you know, publicly available research articles in
> this. But presumably if somebody has made it publicly available for anybody on the internet to see
> their article, then, you know, and they've made it so that you can download the research article
> for free, and it's in the public domain, so to speak, then as long as we give them proper
> attribution or credit, I feel like we could probably just take some public, you know, open access
> article and use it. That would be very interesting.
>
> Anyways, some other ideas relate to this. If we can do this with images, not just PDF pages. Well,
> that opens the door to a lot of things. The first one is just like a storybook, or, sorry, a
> scrapbook, like a photo album. Somebody could upload, you know, a little folder or a set of their
> own photos, family photos or something, put them in there, and then they have a virtual digital
> storybook, and they can customize it in different ways and stuff like that. But then, after kind
> of thinking about that, I had this idea that, well, videos are just a bunch of images taken
> usually in very rapid succession to each other, connected in a sequence, you know, a chronological
> sequence, right? With maybe some sort of audio that was captured and synchronized with the frames.
> Well, if somebody uploads a GIF or a video, perhaps we could somehow split those things. I think
> the GIF would be very easy to split. It's kind of part of the file format anyways, but especially
> for a video. Somebody puts an MP4 on here. What if we created, like, a hologram or a TV screen
> that has, like, a video that they've put on there, and it would all be Gaussian splats, with the
> audio synchronized? Or it could be like a movie theater, okay? Or it could be, like, something
> that's on, like, the laptop. You know, somebody could choose to put their movie on a laptop or
> something like that. But we could also have it just be like a flat 2D sort of hologram where you
> can just, like, move it around and watch it and rotate it. I feel like that could be possible if
> we find a way to convert these images into the Gaussian splats. I feel like mathematically there's
> got to be a way to do it, and there's probably a way to do it with high resolution. Obviously
> Gaussian splats are not the most precise for things that aren't actually scanned. But here's the
> deal: when it comes to images and, like, PDF pages and stuff like that, well, usually the digital
> resolution, unless the stuff is, like, of an actual physical scan, the resolution is, like, about
> as good as it can get, right? Like if I have a digital copy that's printed digitally,
> electronically generated, not just something that was scanned on, like, a physical scanner of,
> like, a real book. But if I look at, like a research article on Archive right now that somebody
> wrote and it's written in LaTeX, well, the quality, like the resolution of that article is maybe
> virtually unlimited, right? Like it's high resolution basically already. So maybe we wouldn't
> actually have to worry about, like, having real scans for those things because, like, if we're
> taking the stuff directly off of the PDFs, then the quality is already, like, about as good as it
> can get. Does that make sense? I feel like that might make it a little bit easier, and it would
> probably be easier to maintain a high resolution, because the quality of the quote-unquote scan is
> not even quality of an actual scan. We actually have the image file. So I wonder if that's even
> possible. That might be an interesting thing that other people haven't created. Maybe some people
> have, but I think that would be really neat. And if we open the door to that, then what's stopping
> somebody from just, like, taking their phone, if it has a high enough resolution, and recording
> some video as, like an MP4 or something, and then just uploading the video and then having it now
> be in Gaussian splat form and they could embed it on their site or something like that. I think
> one of the problems could be that the file size could be an issue, right? Like maybe videos,
> movies, PDFs sometimes, images, they can have, like, a very large file size, relatively speaking,
> much larger than our toys ordinarily would have. I wonder if that's actually a problem. If we look
> at a Gaussian splat, like the highest, the max resolution of something like the grape or the
> blueberry or the raspberry or the blackberry or whatever, okay? Those are about as crisp of
> resolution as anything, probably the best resolution stuff, maybe also, like, the flying bee
> that's in, like, the photo reel set, right? Well, presumably those scans were taken with, like, a
> very high quality camera, and the image files were relatively large. They'd almost have to be if
> they're in such extremely high resolution. So it almost looks like if we're able to have such high
> resolution for the Gaussian splat, unless I'm mistaken and those Gaussian splat, like, toys are
> much bigger in file size, it almost looks like we're able to trim a lot of the file size down even
> if the original images were relatively big. I could be wrong, but that's my intuition. Maybe you
> can correct me if I'm wrong there.
>
> Regardless, it seems like we could very easily, sort of predictably, create the structure of like
> a book or something. You know, where users can flip in stuff and using Gaussian splats as like the
> container. And then for all of the pages, we can load the pages in order with, like, the images or
> the PDFs or something like that, according to the user's specification. Importantly though, there
> needs to be enough resolution for it to still resemble the original article. It doesn't have to be
> perfectly legible. I don't expect it to necessarily be. Although I would be okay if, in order for
> us to make it more legible, we actually make these toys be really big or something. Because the
> user can always just zoom out, right? So if, like, you know, there's only so much we can do in a
> small amount of space with Gaussian splats. It's okay if we allow the toys to be bigger than
> usual, possibly even larger in file size than usual, in order for the resolution and quality to be
> better, so that people can possibly make out what the words are. I feel like we might be able to
> do that programmatically. Obviously it's not going to be perfect for everything, but it would be
> really cool if, you know, like some professor somewhere could take a book or an article that
> they've authored and create a little toy like this and put it on their website, you know, or share
> it or something. And it's interactive and people can flip through it. That would be pretty cool.
> Very, you know, personal kind of thing. Similarly, you know, if you have, like, some photos of
> your family that you want to share with the internet, or, like, a memorable vacation or holiday or
> trip or something like that that you've taken and you want to put it on your website and you want
> to make it into, like, a photo album that people can flip through, you could do it this way with
> Gaussian splats. I don't know. It just seems like there are a lot of possibilities if we could
> find a way to convert the images or PDFs or whatever, like a frame of a video, basically just an
> image into a Gaussian splat with high enough consistency, reliability, and of course precision. If
> that's possible, I really want to explore that. If it's not, then okay, that's all right. But I
> really want to try, even if it means that we have to invent some new things. It should all still
> be Gaussian splats, like the rest of it is. That's kind of the premise of the site, right? But if
> we have to take some time to invent some creative methods for doing this that nobody else has come
> up with, then we'll do it, right? Like, I don't want to roll that out. That's something I want to
> consider. That's not a requirement though. If you know of, like, a good way of already doing that,
> then we should add it in, and you can adapt that or something and make it work with our site here.
> But if we have to invent a new method, then so be it.
>
> One last comment or idea that I have is something about the Gaussian splats themselves. So I
> probably don't have a complete understanding of the math behind Gaussian splats, but I'm wondering
> if we could maybe create, like, a tinkerer operator manual or something like that. You don't have
> to call it that, but it's something kind of like that where if somebody knows the math, they could
> actually, you know, program a Gaussian splat to do something using what we've provided. We've kind
> of touched on that a little bit, but I'd like to know if there's any way to kind of construct
> something so that people can submit their own, like, Gaussian splat equations and play around with
> that stuff here. I don't know enough about the math, like I said, to be able to be more precise
> about this, but it's almost like you are—it could be wrong, but it seems almost like Gaussian
> splats are created here by programming using mathematical equations more or less, right? Roughly,
> it seems like at a high level that's what it is, but I'd like to know, you know, what the
> quote-unquote programming language is, and present it to people so that they can do this stuff
> themselves. That would be pretty neat. Anyways, I have the sound effects reviewed already. So just
> let me know when the right time is for us to do that. I'm hoping you can take what I've given you
> here, think hard about it, take your time, give me your recommendations. You can give me an
> artifact with a prompt in it that I can copy and then submit back to you or something to accept
> all your recommendations. But I want to know what your thoughts are on this, if anybody else has
> done it, if there are any tools or things that we could install that would enable this or that
> would help with this sort of stuff that I've described here. Just give me a full report, and then
> maybe give me your recommendation of, like, how this and these ideas would fit into our current
> timeline, like the things we have planned, like the currently planned steps. Would we do the sound
> effect stuff first, or would we wait until we have added this stuff? My preference, quite frankly,
> is actually to try to handle this stuff first because the sound effects are not so unbelievably
> bad that they are embarrassing to keep on the site for, like, a few more days as we figure out the
> other ideas and stuff that I've mentioned here as we implement those things. Yeah, I do want to
> improve the sound effects, but I also think we could probably have the sound effect stuff be done
> in parallel, because all it really is is kind of, like, a bunch of work updating the sound board,
> and then I review it, and I can do that in parallel with the other stuff that would be, like,
> additional that I've added here. Would it make more sense to add the physics stuff, the
> interactivity that I've mentioned, or other stuff first? I don't know. I'm very flexible about
> this. I just want to make sure that we at least try to do some of these new things that I've
> mentioned here. Anyways, thanks again for all your help. Really appreciate it. This is a very long
> prompt, I understand. I did it all by voice transcription, so you can probably tell. I think that
> I'm going to put this in a Markdown file and just attach it to a prompt and submit it to you. So
> just read all this carefully, obviously, and please try to proceed and do everything here that
> I've asked you to. We can take it one step at a time. We can take our time with it. I'm not in a
> hurry or a rush or anything. Thank you.

## The message he attached it to (September 28)

> Excellent. Thank you so much for all of your help. Now, I actually have some additional ideas that
> I would like to explore with you. So, I completed my sound board review, or just my sound review,
> and I have the note Markdown file for that, and I can give that to you when that's ready. However,
> I will need to actually review the more recent editions before I can do that. I think that we can
> defer the sound upgrade until after we plan, or ideally even after we implement the new things
> that I'm interested in here. So, I have attached a Markdown file containing some ideas. I'm
> wondering if you would please read that very carefully and follow the instructions within it. One
> thing that's not in that Markdown file, it's an idea that I had for a toy, maybe you can fold this
> in, is kind of like a meta toy, so to speak. So for the AI or math or scientific categories, you
> can choose the right category for this to go in. It would be really cool if we actually had a
> Gaussian splat toy. So it would be a Gaussian splat visualization or demo, or something kind of
> like how we have the AI or computer science demos made out of Gaussian splats. That would be very
> interesting. It would be kind of funny. It seems like kind of an obvious meta toy to make. I don't
> know if that's even possible, but we can handle that at the right time. So I'll try to summarize
> here in this prompt what I have included in that Markdown file that I've attached. Basically, I'm
> curious about whether it would be possible to allow users to upload PDFs or images or eventually
> even GIFs and videos, and we could take those files and I guess split them somehow into frames of
> images and then convert those into Gaussian splats and then put them in our site, like as a toy
> that the user can configure. I have a feeling that this is possible, even if nobody's done it
> before, even if it has limitations or it isn't going to be easy to do. I really think that it
> should be possible, because image files are already generally in pretty high quality, and what I'm
> mostly interested in, at least for now, is 2D, kind of like flat representations of the images
> that we will then put into, like, pages of a virtual book, or we can put something on, like, a
> television or on a picture frame or something like that. And so it will be flat anyways. We don't
> need to try to, or at least worry about converting, like, a page into some 3D version of it. It
> will be 2D, I guess, mapped onto a 3D-like page surface so that we can just flip it like a book. I
> don't know what I'm talking about really with this. You do though, so hopefully you can think hard
> about this and help me integrate this, these ideas. I think I want to do that before we add or
> upgrade the sound effects. That way I can do, like, a sound review one time. We don't have to
> really return to the sounds for a while. I don't know if you think it would be better to handle
> the physics or the multi-toy scenes or anything like that prior to adding this. But since this is
> basically just, like, a new toy concept, a new toy category or type, I feel like we could take the
> time to build it. But to do it properly, we're really going to have to, like, dedicate
> considerable effort to this, I think. But I want it to be really good. And if we have to build
> something that's external, like an external engine or some kind of tool that does this conversion
> between PDF and splat, and then take that engine or that tool and bring it into our site and then
> use that, then I'd like to. I don't know if it's possible. Please give me your full report and
> full ideas, and help me figure out how we should do this and when we should do it. I'd like to try
> to build that as soon as possible, or at least as soon as is reasonable. It doesn't exactly have
> to be immediately, but I would like to get the ball rolling on this soon. And we can use parallel
> worker sessions for all of this stuff. I'm fine with that. So please read this, please prepare me
> accordingly. I'm going to take a look at the, like, routines, suggested toys, maybe put my
> feedback in that artifact or whatever, and we can proceed accordingly. Thank you again for all
> your help. I really appreciate it.

## His answer to the report (September 28)

> Incredible. I agree with your recommendations completely. I've pasted that prompt below. Also,
> please tell me when I'm able to give you my sound review notes; unless you recommend otherwise,
> I'll give them to you right here, and you can dispatch any session(s) for building, etc. like
> we've been doing so far. Thanks again for your help!
>
> ---
>
> I accept the plan on the Pages into Splats page (September 28, 2026):
>
> 1. Order: "Pictures and pages" becomes step 3, before pianos and the physics work. The sound lanes
>    start whenever I send my sound notes, in parallel. The new toys' sounds join the later new-toys
>    sound round.
> 2. Start with the engine lane: pictures to splats (PDF pages, photos, GIF and video frames), pages
>    that stream through a few sheets, near and far detail, Open a file in the Toy tab, and a web
>    address for embeds. Keep the new toys behind a hidden switch until I've tried them on my phone.
> 3. You may vendor PDF.js (Apache 2.0) and omggif (MIT), loaded only when someone opens a PDF or a
>    GIF.
> 4. Then the toy lanes, on a new shelf called "Pictures and pages": Your book, Photo album, Picture
>    frame and Screen (old TV, flat TV, cinema, hologram, with sound). Also the Gaussian splat toy
>    on the AI and computing shelf, and the splat equation toy with a public Tinkerer's Manual that
>    is also the book's default PDF.
> 5. Samples only under CC0, CC BY or public domain, with credits. No logos or insignia.
> 6. The laptop stays as it is.
> 7. The fitted method (fewer, sharper splats) comes later, as an upgrade.

What the Operator did: filed this, changed the plan (ROADMAP.md, WORKSTREAMS.md, HANDOFF.md) and
started the engine lane, Pictures, the same day.
