# Splashery Review 2026-09-27 (lanes AI and Math, and two earlier toys)

The owner's review of the first clips from lane AI (PR #52) and lane Math (PR #50), with two notes
on toys approved earlier, word for word. It came in two parts: marks and notes on the private Effect
review page (its `verdicts` database), and a chat message with two images. The first image is Figure
1 of "Attention Is All You Need" (Vaswani et al., 2017), the encoder-decoder transformer diagram,
which the transformer note refers to. It is not saved here because it is the paper's figure; the
Operator described it to lane AI. The second is a screenshot of the bananas' tap
([banana-stem.png](banana-stem.png)), with the loose stem circled in red.

Where it went: the AI and Math notes are being built into PRs #52 and #50 (second round, cards
`-r2`); the bananas and the ocean wave went to a new lane, Fix3; the toy help idea is step 2 of the
plan in [ROADMAP.md](../../ROADMAP.md).

## Marks on the Effect review page

"Looks right" (7): Gradient descent (ai-gradient-descent), Half adder (ai-half-adder), American
football (math-american-football), Graph plotter (math-graph-plotter), Pythagoras proof
(math-pythagoras-proof), Snail: hide and come out (math-snail), Surface plotter
(math-surface-plotter).

"Needs work" (13), with the notes as written:

- **Convolutional network (ai-cnn):** This looks perfect for the 2D "poster" version. In addition to
  this version, I want an actual 3D version. Please take a look at the repo
  https://github.com/okdalto/CNN-visualization ... the user can draw a number, and the 3D CNN
  responds accordingly. Can you try to reproduce this for the 3D version of the CNN, using Gaussian
  splats?
- **Diffusion model (ai-diffusion-model):** This looks perfect for the 2D "poster" version. In
  addition to this version, I want an actual 3D version.
- **Looped transformer (ai-looped-transformer):** This looks perfect for the 2D "poster" version. In
  addition to this version, I want an actual 3D version.
- **Neural network (ai-neural-network):** This looks perfect for the 2D "poster" version. In
  addition to this version, I want an actual 3D version. The user should be able to configure other
  things, as well, such as numbers of nodes/neurons, etc.
- **Perceptron (ai-perceptron):** This looks perfect for the 2D "poster" version. In addition to
  this version, I want an actual 3D version. Can we also add 2D "poster" and 3D multilayer
  perceptrons (MLPs)?
- **Recurrent network (ai-rnn):** This looks perfect for the 2D "poster" version. In addition to
  this version, I want an actual 3D version.
- **Sorting machine (ai-sorting-machine):** This looks nearly perfect already, and I appreciate the
  quicksort and merge sort options. I have two requests for this: 1. Can we put the sorting method's
  name above the "SWAPS" counter or somewhere on the actual toy? 2. Can we add even more sorting
  algorithms for the user to choose from?
- **Transformer (ai-transformer):** This is a good variant of the 2D "poster" version, and we should
  keep it. However, I was thinking of the more traditional transformer architecture diagram. I'll
  attach an image for you to look at. We could make that more traditional version another dynamic
  version of the 2D "poster" version of the transformer. In addition to the two 2D versions, I want
  an actual 3D version for each of them.
- **Word vectors (ai-word-vectors):** This looks basically perfect, but can we allow the user to
  enter their own text, and actually have the arrows work accurately (with validity) for any items
  entered by the user? For example, the user could replace "MAN" with "PINEAPPLE", and the arrow
  would go from "PINEAPPLE" to "APPLE" or something. If not, that's fine.
- **Ocean wave (e4-ocean-wave-r2):** Sorry to have locked this in too early... the rebuilding of the
  wave looks basically perfect, but the collapse happens awkwardly; it should be smooth, not so
  jagged, and it needs to happen more naturally.
- **Bananas (e5-banana-r2):** Sorry to have approved this one earlier than I should have... I've
  attached a screenshot of this – the stem (I think it's a stem) of the middle banana is really
  awkward and not connected properly. Can you fix that for me?
- **Fourier circles (math-fourier-circles):** Looks basically perfect for 2D; can we add a 3D
  version as well? And can we allow the user to enter their own equation or configure the parameters
  somehow? Is there a way to allow the user to enter a custom string, e.g., their name ("Ryan"), and
  have the Fourier circles (possibly using multiple of these) spell out the string? If so, then we
  could add support for all letters of the alphabet and numbers. What about emoji support?
- **Circle and waves (math-unit-circle):** Looks basically perfect for 2D; can we add a 3D version
  as well? And can we allow the user to enter their own equation or configure the parameters
  somehow?

## The chat message

> Thank you for your help. I've updated the Effect Review artifact with my notes for these most
> recent lanes. Can you read that carefully and update what's necessary for me? I've attached an
> image for the transformer, etc. I mainly just have additional features or extra toys that I want
> to add, and most of the work is virtually perfect already. I'm not sure if these changes will
> affect the PRs, so I'll give you this prompt now and wait for your go-ahead on which PRs can be
> merged and the merge order while you're working or afterwards. Thanks again for all of your help!
>
> Oh, I also updated some previously approved toys from the rest of that artifact with some notes.
> I've attached a screenshot of the little banana problem, where the stem issue is circled in red.
> The other item is the ocean wave, which needs to look more natural.
>
> One additional thing that perhaps you can add or fold into our plans: When I open the site and go
> to a new toy (or have refreshed the page, etc.), I'd like to briefly see information on the screen
> (not overlapping the toy, if possible) that concisely tells the user how to play with the toy. For
> example, if I open the puzzle cube, it would be nice to know that I can drag a row or column in a
> direction to turn that; other examples: how to use the chess toy, how to play the xylophone, etc.
> We will eventually have this brief type of instructions for every toy in the gallery. And within
> the configuration panel, perhaps we can add a new tab or put the info in the main tab, etc., with
> a proper description of what the toy shows or means, what you can do with it, etc. That way, if
> someone sees something they don't recognize, they can learn a little bit about it without needing
> to leave the site to search for it.
