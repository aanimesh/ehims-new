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
import warnings
warnings.filterwarnings("ignore", category=UserWarning)

'''
perform basic networks analysis on messages
gather basic stats on channel
generate a .xlsx file consisted of 2 sheets (participants, messages)  and a .txt file with basic info about this channel
'''

def get_stats():
    file = open(filedir+group_stats, 'w+')
    file.write('Channel basic information:\n')
    file.write('ID:\t{}\n'.format(group['channel_id']))
    file.write('Name:\t{}\n'.format(group['name']))
    file.write('Type:\t{}\n'.format(group['chat_type']))
    file.write('Tree Views:\t{}\n'.format(group['tree_views']))
    file.write('Start At:\t{}\n'.format(group['started_at']))
    file.write('Duration:\t{} min\n'.format(group['duration'] if 'duration' in group.keys() else 'unknown'))
    file.write('Participants:\t{} ({} participants)\n'.format(
        ', '.join([tester['name'] for tester in group['participants']]), len(group['participants'])))
    file.write('Number of messages:\t{}\n'.format(len(group['messages'])))
    file.write('Avg number of messages sent per person:\t{}\n'.format(
        round(len(group['messages']) / len(group['participants']), 2)))

    if len(group['messages']) > 0 and len(relation) > 0:
	    file.write('\n\nGraph basic stats:\n')
	    file.write('Density:\t{}\n'.format(density))
	    file.write('Number of edges:\t{}\n'.format(edges_num))
	    file.write('Number of nodes:\t{}\n'.format(nodes_num))
	    file.write('Number of root messages:\t{}\n'.format(len(root_msg)))
	    file.write('Max graph depth:\t{}\n'.format(max_height))
	    file.write('Max graph width:\t{}\n'.format(max_graph_width))
    file.close()


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


def calculate_hierarchy():
    msg_hierarchy = {}
    for root in root_msg:
        c_h = 0
        msg_hierarchy[root] = c_h
        current_h = [root]
        while True:
            children_h = []
            c_h += 1
            for cnode in current_h:
                for child in G_msg.neighbors(cnode):
                    if child not in msg_hierarchy.keys():
                        msg_hierarchy[child] = c_h
                        children_h.append(child)
            current_h = children_h
            if not len(current_h):
                break
    return msg_hierarchy


def msg_position(msg_hierarchy):
    layer_width = {layer: len(list(nodes)) for layer, nodes in itertools.groupby(sorted(msg_hierarchy.values()))}
    is_end = [0 for x in range(len(layer_width))]
    pos_dict = {}
    for key_node, h in msg_hierarchy.items():
        pos_dict[key_node] = (is_end[h], len(layer_width)-h)
        is_end[h] += 1
    return pos_dict


group = ''
for line in fileinput.input():
    group += line
group = json.loads(group)


#channel = '5d964cec26c1594270c72e08'    # modify this line to process different channel messages
#file_path = r'raw_data/channel-{}.json'.format(channel)
channel = group['channel_id']
filedir = r'tmp_file/'
channeldir = r'channel-{}/'.format(channel)
group_stats = r'channel-{}.txt'.format(channel)
group_info = r'channel-{}.xlsx'.format(channel)
plt_path = r'channel-{}.png'.format(channel)
zipObj = ZipFile('tmp_file/channel.zip'.format(channel), 'w')
relation = []
root_msg = []
attributes = {}
authors = []

for key, msg in group['messages'].items():
    msg['bookmarked'] = len(msg['bookmarked'])
    msg['likes'] = len(msg['likes'])
    msg['content_length'] = len(msg['content'].split())
    msg['children'] = ', '.join(msg['children'])
    msg['original_version'] = len(msg['original_version'])
    authors.append(msg['author'])
    if 'msg_parent' not in msg.keys():
        root_msg.append(key)
    elif msg['msg_parent'] == None:
        root_msg.append(key)
    relation.extend([(key, cmsg.strip()) for cmsg in list(filter(lambda x: x != '',
                                                             msg['children'].replace(' ', '').split(',')))])
    attributes[key] = {k: v for k, v in msg.items() if k not in ['msg_parent', 'other_parents', 'children',
                                                                 'seen_by', 'updated_at', 'content', '_id']}
authors = list(set(authors))

if len(group['messages']) > 0 and len(relation) > 0:
    G_msg = nx.DiGraph()

    for rnode in root_msg:
        G_msg.add_node(rnode) 
    G_msg.add_edges_from(relation, label='parent')
    nx.set_node_attributes(G_msg, attributes)

    density = nx.density(G_msg)
    # diameter = nx.diameter(G_msg.to_undirected())
    nodes_num = nx.number_of_nodes(G_msg)
    edges_num = nx.number_of_edges(G_msg)  # portion of nodes in the tree

    max_height = len(nx.dag_longest_path(G_msg)) if len(group['messages']) > 1 else 1

    ''' Messages Stats '''
    df = pd.DataFrame.from_dict(group['messages'], orient='index', columns=['original_version', 'other_parents', 'children',
                                                                            'seen_by', 'likes', 'bookmarked', '_id',
                                                                            'author', 'channel', 'content', 'created_at',
                                                                            'updated_at', '__v', 'content_length'])
    df = df.drop(['children', '__v', 'other_parents', 'seen_by', 'channel', '_id'], axis=1)
    mid = df.index.tolist()
    centrality = nx.degree_centrality(G_msg)
    in_centrality = nx.in_degree_centrality(G_msg)
    out_centrality = nx.out_degree_centrality(G_msg)
    df['centrality'] = pd.Series(list(map(lambda m: centrality[m] if m in centrality.keys() else 0, mid)), index=df.index)
    df['in_centrality'] = pd.Series(list(map(lambda m: in_centrality[m] if m in centrality.keys() else 0, mid)), index=df.index)
    df['out_centrality'] = pd.Series(list(map(lambda m: out_centrality[m] if m in centrality.keys() else 0, mid)), index=df.index)

    closeness_centrality, descendants, successors, predecessors, reaching_centrality, subtree_width, successors_authors, \
        descendants_authors = [], [], [], [], [], [], [], []

    for node in mid:
        if node:
            closeness_centrality.append(nx.closeness_centrality(G_msg, node) if node not in root_msg else None)
            descendants.append(len(list(nx.descendants(G_msg, node))))
            descendants_authors.append([G_msg.node[cn]['author'] if 'author' in G_msg.node[cn].keys() else None
                                        for cn in nx.descendants(G_msg, node)])
            successors.append(len(list(G_msg.neighbors(node))))
            successors_authors.append([G_msg.node[cn]['author'] if 'author' in G_msg.node[cn].keys() else None
                                       for cn in G_msg.neighbors(node)])
            predecessors.append(len(list(G_msg.predecessors(node))))
            reaching_centrality.append(nx.local_reaching_centrality(G_msg, node))
            subtree_width.append(tree_width(node))
    df['closeness_centrality'] = pd.Series(closeness_centrality, index=df.index)
    df['descendants'] = pd.Series(descendants, index=df.index)
    df['successors'] = pd.Series(successors, index=df.index)
    df['predecessors'] = pd.Series(predecessors, index=df.index)
    df['reaching_centrality'] = pd.Series(reaching_centrality, index=df.index)
    df['subtree_width'] = pd.Series(subtree_width, index=df.index)
    for author in authors:
        df['percent of descendants author {}'.format(author)] = pd.Series([alist.count(author) / len(alist)
            if len(alist) else 0 for alist in descendants_authors], index=df.index)
    for author in authors:
        df['percent of successors author {}'.format(author)] = pd.Series([alist.count(author) / len(alist)
            if len(alist) else 0 for alist in successors_authors], index=df.index)

    df = df.fillna(0)
    max_graph_width = max(subtree_width)

    ''' Author Stats '''
    df1 = pd.DataFrame(index=['messages_no', 'max_centrality', 'avg_centrality', 'max_in_centrality', 'avg_in_centrality',
                              'max_out_centrality', 'avg_out_centrality', 'max_closeness_centrality', 'avg_closeness_centrality',
                              'max_descendants', 'avg_descendants', 'max_successors', 'avg_successors', 'max_predecessors',
                              'avg_predecessors', 'max_reaching_centrality', 'avg_reaching_centrality', 'max_subtree_width',
                              'avg_subtree_width'],
                       columns=authors)
    for author in authors:
        df2 = df.loc[lambda row: row['author'] == author]
        colmax = df2.max()
        colavg = df2.mean()
        df1[author] = pd.Series([df2.index.size, colmax['centrality'], colavg['centrality'], colmax['in_centrality'],
                                colavg['in_centrality'], colmax['out_centrality'], colavg['out_centrality'],
                                colmax['closeness_centrality'], colavg['closeness_centrality'], colmax['descendants'],
                                colavg['descendants'], colmax['successors'], colavg['successors'], colmax['predecessors'],
                                colavg['predecessors'], colmax['reaching_centrality'], colavg['reaching_centrality'],
                                colmax['subtree_width'], colavg['subtree_width']], index=df1.index)

    with pd.ExcelWriter(filedir+group_info) as writer:
        df.to_excel(writer, sheet_name='messages', encoding='utf8')
        df1.to_excel(writer, sheet_name='participants', encoding='utf8')

    plt.title('messages_network')
    msg_color = [authors.index(G_msg.node[node]['author']) if 'author' in G_msg.node[node].keys() else len(authors)
                 for node in G_msg.nodes()]
    pos = msg_position(calculate_hierarchy())
    nx.draw_networkx(G_msg, pos=pos, node_size=150, node_color=msg_color, cmap=plt.cm.Paired, with_labels=False, arrowstyle='fancy',
    arrowsize=5)
    # plt.show()
    plt.savefig(filedir+plt_path)
    zipObj.write(filedir+plt_path)
    zipObj.write(filedir+group_info)
    os.remove(filedir+plt_path)
    os.remove(filedir+group_info)

get_stats()
zipObj.write(filedir+group_stats)
os.remove(filedir+group_stats)
zipObj.close()
print('done')


