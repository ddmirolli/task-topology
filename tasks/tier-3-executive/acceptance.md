# Tier 3 acceptance tests

Run against the deployed public URL. Each test is automated. All must
pass.

## Reachability

1. The public URL returns a page within 5 seconds.
2. HTTPS works.

## Accounts

3. Two users can sign up with email and password.
4. A user can log in and log out.
5. A logged out user cannot see tickets.

## Tickets

6. Create a ticket with title and description.
7. Assign a ticket to the other user.
8. Add a comment to a ticket.
9. Move a ticket through at least three statuses in order.
10. Edit a ticket's title.
11. Search finds a ticket by a word in its title.
12. Search finds a ticket by a word in a comment.

## Durability

13. Restart the app container. Every ticket, comment and assignment from
    tests 6 to 12 is still there.
14. Restart the app container again. Users can still log in.

## Sanity

15. Creating 200 tickets in a loop completes and the list page still
    loads within 5 seconds.
16. A user cannot edit another user's account.
