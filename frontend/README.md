The Image Service Component
===========================

This small Application consists of set of Componenets that take cre of certain tasks.

- Uploader
- Finder
- Settings
  - Globals
  - Presets
- List 
- List Item
  - Preview
  - Attributes
  - Actions
- SirTrevor Extension



Start Developing:

*  npm install

Building the modified extension:

*  ./build.sh



The Uploader
--------------

Loads Images form the harddisk of the user and fires an Event that an Image has been loaded

The Finder
--------------
Makes an ajax call to the backend, asking for an image matching a search parameter, and shows a list of possible 
images for the user to choose. On choosing, the component send an Event that an image has been loaded

Settings
--------------
The settings componenet show a set of sub components that have an getData method, and register them selves  
against the settings componenet with an Event-fire.
Two components register themselves for the Settings interface. 
  - Globals - Shows a set of attributes that are related to the set of images for this instance
  - Presets - Shows a set of attributes that will be used to pre-fill the newly uploaded images
 
List
-------------
Show a list of ListItems-like Components. Listenes for the event of Image Loaded and creates a new List Item
and shows the rendered HTML. The list listens for the Events of Item- DELETED or EXCLUDED

List Item
-------------
A component generating an HTML for a List item. It has a Preview, Attributes and an Actions part. 
The Preview and Actions are simple components so far, but will get their own Factories. The Attributes 
have their own Factory, that generates the right Component based on the provided definitions for the ListItem Factory

Sir Trevor Extension
------------
A simple extension that adds a Sir Trevor Component holding the ImageService
 
