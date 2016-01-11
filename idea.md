# Data Model

User:
    Name (unique)
    List of channels

Channel:
    Name (unique)
    List of online users (and associated colours)
    Top level messages

Message:
    User
    channel
    ID (unique in channel)
    Parent
    List of children


# To Do
- Log all clicks and views

