# code-rules

1. never reset the database
2. never expose sensitive data
3. never create duplication. ALWAYS check for existing code before creating new.
4. never comment out code to fix an issue. Always fix code properly
5. always adhere to core architecture
6. never change the architecture without explicit consent
7. organize documents into /Architecture, /Development, /temp. If they do not match one of those categories then store in /docs for manual review. Store any non-permanent .md files in the temp folder
8. never change the env. This include .local
9. use toast for front end notifications. do not include frontend error or success logs unless its toast


This command will be available in chat with /code-rules
