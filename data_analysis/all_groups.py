# -*- coding: utf-8 -*-
import fileinput
import json
import networkx as nx
import matplotlib.pyplot as plt
import pandas as pd
from matplotlib import cm
import itertools
from zipfile import ZipFile
import os
from functools import reduce
import warnings
warnings.filterwarnings("ignore", category=UserWarning)


def tree_width(nodes):
    max_width = 0
    nodes = [nodes]
    while True:
        current_h = []
        for n in nodes:
            current_h.extend(list(G_msg.neighbors(n)))
        max_width = len(current_h) if len(current_h) > max_width else max_width
        if not len(current_h):
            return max_width
        else:
            nodes = current_h


group = ''
for line in fileinput.input():
    group += line
group = json.loads(group)
channels = group['channels']
channeldir = r'tmp_file/all-channels.csv'
table = {}


for channel in channels:
    name = channel['name']
    ctype = channel['chat_type']
    tree_views = channel['tree_views'] if 'tree_views' in channel.keys() else 'unknown'
    started_at = channel['started_at'] if 'started_at' in channel.keys() else 'unknown'
    duration = channel['duration'] if 'duration' in channel.keys() else 0
    participants = 0 if 'participants' not in channel.keys() else len(channel['participants'])
    root_msg_len = len(channel['top_lvl_messages'])

    relation, root_msg = [], []
    likes, bookmarks, versions, merged_msg, merged_msg_parent, parents, children = 0, 0, 0, 0, 0, 0, 0
    messages = {item['_id']: item for item in group['messages'] if item['channel'] == channel['_id']}

    for mid in messages.keys(): 
        message = messages[mid]
        likes += len(message['likes'])
        bookmarks += len(message['bookmarked'])
        versions += len(message['original_version'])
        children += len(message['children'])

        if 'msg_parent' not in message.keys():
            root_msg.append(mid)
        elif message['msg_parent'] == None:
            root_msg.append(mid)
        else:
            parents += len(message['other_parents']) + 1
            if len(message['other_parents']) > 0:
                merged_msg += 1
                merged_msg_parent += len(message['other_parents']) + 1
        relation.extend([(mid, cmsg.strip()) for cmsg in list(filter(lambda x: x.replace(' ', '').strip() != '',
                                                             message['children']))])

    mlen = len(messages)
    avg_msg_per_person = 0  if not participants else mlen / participants
    avg_children = 0 if not mlen else children / mlen
    avg_parent_per_msg = 0 if not mlen else parents / mlen
    avg_parent_merged_msg = 0 if not merged_msg else merged_msg_parent / merged_msg
    avg_likes = 0 if not mlen else likes / mlen
    avg_bk = 0 if not mlen else bookmarks / mlen
    avg_versions = 0 if not mlen else versions / mlen
    
    if len(messages) > 0 and len(relation) > 0:
        G_msg = nx.DiGraph()
        for rnode in root_msg:
            G_msg.add_node(rnode) 
        G_msg.add_edges_from(relation, label='parent')

        edges = nx.number_of_edges(G_msg)
        depth = 1 if not nx.is_directed_acyclic_graph(G_msg) else len(nx.dag_longest_path(G_msg))
        width = reduce(lambda x, y: x+y, [tree_width(node) for node in root_msg])
        density = nx.density(G_msg)
    elif not len(messages):
        edges, depth, width, density = 0, 0, 0, 0
    else:
        edges, density = 0, 0
        depth, width = 1, 1

    table[channel['_id']] = [name, ctype, tree_views, started_at, duration, participants, mlen, edges, root_msg_len, merged_msg, 
                    avg_msg_per_person, avg_children, avg_parent_per_msg, avg_parent_merged_msg, depth, width, density,
                    avg_likes, avg_bk, avg_versions]


df = pd.DataFrame.from_dict(table, orient='index', columns=['name', 'type', 'tree views', 'started at', 'duration',
                            'participants', 'messages', 'edges', 'root messages', 'merged messages', 'avg no of messages sent per participant',
                            'avg children of all messages', 'avg parents of all messages', 'avg parents of merged messages', 
                            'depth', 'width', 'density', 'avg likes', 'avg bookmarks', 'avg versions'])
df.fillna(0, inplace=True)
df.to_csv(channeldir)
print('done')


