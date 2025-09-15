# Obsidian: See You Again

1. Add **usage contexts** to your notes
2. See your notes again just when you need them

## Installation

I'm trying to get this plugin accepted as an official Obsidian.md plugin.

Until then, it can be installed [manually](https://www.reddit.com/r/ObsidianMD/comments/tpodka/how_can_i_manually_install_plugins/).

## Context

I have a lot of notes in my Obsidian notes, and I add more of them every day.
For the longest time, I have grappled with the problem on how to actually remember than when I need them.

Nod along if any of the following seems familiar:

- You keep adding blog posts to your vault with the intention of reading them, but you never do
- You save your favorite youtube videos in your vault so you can rewatch them when you are in the mood for entertainment, but you never actually do
- You have a bunch of great quotes in your vault because you want to memorize them, but you never do
- You track habits or todos in your vault, except that you don't actually track them, you just create the notes and forget about them
- You store material related to some hobby in your vault, but you never actually look at them when practicing the hobby

...and so on. This plugin is my (latest) attempt to solve this problem.

## Usage 

### Adding Contexts

To use this plugin, you first must add contexts to some notes.
You can do this in the following ways:

- using the command `Manage contexts for currently open note` (access the command menu with `Ctrl`/`Cmd` + `P`)
  - if you have a specific note that you feel like you never actually utilize, this is a great way to get started
- clicking the "tags" icon in the sidebar, which does the same thing
- using the command `Add context to a random note`, which works very similar, only it opens a random note from your vault that doesn't have contexts yet
  - this is a great way of getting into a flow of tagging notes with contexts without getting bored
- using the command `Batch-add contexts for all search results`, which is an advanced convenience function to quickly integrate a bunch of notes into the system

---

A "context" is a situation, question or, well, context, *in which you want to see or interact with a given note*. 
You can input anything you want, here are some contexts that I use:

- `daily`
- `sometimes`
- `when reflecting on my productivity`
- `when taking career decisions`
- `when bored`
- `taking a break`
- `first thing in the morning`
- `when asked for movie recommendations`
- `when stuck on a problem`
- `when I want to study Chinese`

---

If you give note a *usage context*, you also give it an *action*. An "action" is what you are supposed to do with the note if it comes up in this context. There are the following five possibilities:

- `look-at` (doing nothing)
- `iterate` (do an action; improve; get done)
- `memorize` (practice this note as a flashcard)
- `evaluate` (notes that are a question that you interactively answer)
- `schedule` (bigger habits where you set an implementation intention)


### Examples

I may create the following note:

```
📖 A Psalm for the Wild-Built.md
```

```
---
see-you-again:
  daily: iterate
  when-i-want-to-re-read-fiction: look-at
  when-i-get-asked-for-wholesome-books: look-at
---

* Author: [[Becky Chambers]]
```

This will achieve the following:
- in the `daily` context (which I have a habit of looking at every day), I `iterate` this book (i.e. read it for a bit)
- when I'm asked for nice-to-read book recommendations, I can start the `when-i-get-asked-for-wholesome-books` context and this will come up randomly
- when I'm in the mood to re-read a book I previously enjoyed, I can start the `when-i-want-to-re-read-fiction` context and this will come up randomly

---

Here is another example:

```
are you satisfied with the amount of exercise done in the last 24 hours﹖.md
```
```
---
see-you-again:
  end-of-month: iterate
  daily: evaluate
---
```
This will achieve the following:
- `everyday`, I will `evaluate` (= write a short text answer) on whether or not I am satisified with the amount of exercise I'm doing
- at the end of the month, this note will sometimes come up randomly and I can rethink the habit, rephrase the question, think about ideas to do better, etc.

---

### Browsing a Context

Now comes the payoff!

Use the command `Start queue for context...` (or use the swords icon on the sidebar) to select a context. For example, when you are currently bored, start the "when bored" context. 


You will be presented with relevant notes from your vault. This is the whole point of the plugin!

## Advanced Usage

### Removing Context

In the context-note-flow, you can use the "Remove Context" button to remove the currently active context from a note. This is useful for scenarios such as when you finished a book or done a to-do.

### Memorization

The memorization mode tries to smartly optimize the process of learning the content of a note.

- It uses `fsrs` to ideally space repetitions
- If it detects "---" in your note, it interprets what comes before as the front of a flashcard and the rest of a back that you have to remember
- If your note title starts with ">", it assumes the goal is to memorize the title verbatim (useful for quotes)
- Otherwise, it uses the title as the "front" of the flashcard and the body as the back

### Finding Notes That Have No Context Yet

*If you want to find out for which notes you haven't thought about their usage context yet, this function is your friend*

Simply use Obsidian's search: `-"see-you-again" path:md`


### Finding Notes That Explicitly Have No Context Set

*Such notes will not show up in any context, and never show up in `Add context to a random note`. If you are using this plugin to fight Collector's fallacy, this function may help you to find notes that really have no point and maybe should be deleted.*

Simply use Obsidian's search: `"see-you-again: {}"`
