Let's actually adapt the UI of [context note viewer](src/modals/contextNoteViewerModal.ts) depending on which [type of action was saved for the note for this context](src/types.ts).


- `look-at`: Current note look, prompt "Consider this"
- `do`: prompt "Do this", standard UI
- `iterate`: prompt "Make some progress with this", standard UI
- `schedule`: prompt "Write down when and where you are going to do this", standard UI
- `improve`: prompt "Improve this note", standard UI. The user is supposed to jump to the note and change something, only then the "Done" button is enabled. Make sure to smartly track this. Do NOT!! abuse plugin settings for this
- `evaluate`: prompt "Evaluate". Offer a text box where the user can write an evaluation. On "Done" button, add this as a bullet point to the end of the note
- `memorize`: prompt "think of the answer". Show only the heading of the note, hide the body of the note behind a "reveal" button. No "Done" button (skip, jump to note, etc re still there). When reveal is clicked, show note body and below it four buttons "Wrong", "Hard", "Correct", "Easy". For now, they should do NOThING!!!!!!!!!!!!!!!!! yes NOTHING!!!!!!!!!!! except the exact same thing as "Save and Next" usually does