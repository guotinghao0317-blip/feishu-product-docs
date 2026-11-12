# 飞书产品文档技能

用飞书历史资料和可验证的业务数据写产品调研、方案对比与 PRD。技能可以用飞书 CLI 读取原文、向群里的资料助手和 BI 助手提问、写入并回读云文档。PRD 包含可直接使用的写作标准和示例。

## 一、安装前确认

| 准备人 | 需要准备什么 |
| --- | --- |
| 使用者 | 能运行 Codex 技能和飞书 CLI 的本地环境，以及能访问目标飞书群和文档的个人账号。 |
| 飞书应用负责人或租户管理员 | 提供组织已批准的 CLI 应用，或按组织流程建立自建应用。启用实际操作所需的 API 权限，并确认目标使用者能使用已发布的应用版本。 |
| 群主或管理员 | 要自动向助手取材时，在飞书里建群或选一个已有群，邀请使用者和相应助手。 |
| 资料助手负责人 | 准备一个能在群里接受提问、检索历史资料并交付可读飞书云文档的助手。它需要相应的来源访问权限。 |
| BI 或数据管理员 | 要跑数时，准备有查询权限的 BI 助手或组织批准的只读数据入口。语音 trace 接入是可选项。 |

只使用用户已给的资料写文档时，可以跳过建群和配置助手。要把结果写回飞书，仍需安装 CLI、登录并拥有目标位置的写入权限。

## 二、安装技能和飞书 CLI

1. 把这个目录完整放到 Codex 的技能目录，例如 `~/.codex/skills/feishu-product-docs/`。目录下应直接包含 [SKILL.md](SKILL.md) 和 `references/`。已有同名技能时，请先确定要保留哪一版。
2. 按 [飞书 CLI 官方说明](https://github.com/larksuite/cli/blob/main/README.zh.md) 安装，并运行 `lark-cli --version`。如果使用 npm 安装，先准备 Node.js 和 npm，再运行 `npx @larksuite/cli@latest install`。
3. 运行 `lark-cli config init`，按提示配置组织批准的应用。已有 CLI 应用时复用它。应用密钥通过 CLI 的交互输入或受保护的标准输入提供，交由 CLI 管理。
4. 为实际操作申请下节所列权限。使用者以本人飞书账号完成 OAuth 后，运行 `lark-cli auth status --json --verify` 检查当前账号。

## 三、配置权限

应用权限、个人 OAuth 和资源访问是三个环节。都满足后，用 CLI 登录的用户才可以操作相应的群或文档。

| 环节 | 由谁操作 | 开通范围 |
| --- | --- | --- |
| 应用 API 权限 | 应用负责人或租户管理员 | 按下方操作清单开通。原文在知识库时，按需加知识库节点读取。使用飞书原生流程图时，按需加画板操作。 |
| 个人 OAuth | 实际使用者 | 授权本次需要的 scopes，完成浏览器登录。后续在群和文档命令中显式使用 `--as user`。 |
| 飞书资源访问 | 群主、文档负责人或知识库管理员 | 使用者加入目标群并能看群消息，能读引用原文，能在目标文件夹或知识库创建文档，或能编辑指定文档。资料助手也要能读它检索的资料，并把完整报告分享给使用者。 |
| 可选取数 | BI 或数据管理员 | 给相应 BI 助手或查询用户开通批准的数据源和实际表、列的读取权限。有独立数据网关时，按其要求完成 SSO 或 OAuth。 |

常用的 CLI 操作和 scope：

| 要做的操作 | scope |
| --- | --- |
| 搜索群、核对群成员 | `im:chat:read`、`im:chat.members:read` |
| 读群消息和话题 | `im:message:readonly`、`im:message.group_msg:get_as_user` |
| 以用户身份发群消息 | `im:message`、`im:message.send_as_user` |
| 读云文档 | `docx:document:readonly` |
| 新建云文档 | `docx:document:create` |
| 修改并回读云文档 | `docx:document:write_only`、`docx:document:readonly` |

相关命令的权限定义可在飞书 CLI 源码查阅。[群成员](https://github.com/larksuite/cli/blob/main/shortcuts/im/im_chat_members_list.go) · [群消息](https://github.com/larksuite/cli/blob/main/shortcuts/im/im_chat_messages_list.go) · [发消息](https://github.com/larksuite/cli/blob/main/skills/lark-im/references/lark-im-messages-send.md) · [读文档](https://github.com/larksuite/cli/blob/main/shortcuts/doc/docs_fetch.go) · [新建文档](https://github.com/larksuite/cli/blob/main/shortcuts/doc/docs_create.go) · [更新文档](https://github.com/larksuite/cli/blob/main/shortcuts/doc/docs_update.go)

在配置好应用的环境运行 `lark-cli auth scopes --json` 查看应用已启用的 scopes。不同 CLI 版本和操作需要的 scope 可能不同，按本机的 `--help`、`lark-cli skills read lark-im`、`lark-cli skills read lark-doc` 和命令返回的 `missing_scopes` 核对。以下以用户身份发消息为例。把本次所需的 scope 按空格放在同一组引号里，再完成授权。

```bash
lark-cli auth login --scope "im:message im:message.send_as_user"
lark-cli auth check --scope "im:message im:message.send_as_user"
```

遇到无法登录或系统钥匙串不可用时，先在可以正常访问钥匙串的环境完成授权。能登录 CLI 但打不开某篇文档时，请文档负责人检查该账号的访问权限。Aily 网页有独立登录状态，优先请资料助手把完整任务和引用转成可访问的飞书云文档。

## 四、手动建群和邀请助手

1. 在飞书客户端创建协作群，或选一个已有群。由群主或有邀请权限的成员把要用 CLI 操作的飞书用户拉进群。
2. 把资料助手和需要的 BI 助手加入同一个群。应用机器人一般通过群设置的「群机器人」或「添加机器人」加入。普通成员通过群成员邀请。找不到助手时，请应用负责人检查机器人能力、发布状态和租户可用范围，请群主检查邀请权限。参考 [飞书机器人常见问题](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/guide/faq)。
3. 使用者在飞书客户端分别手动 @ 需要的助手，确认它能接收并回复任务。让资料助手试交付一份带原始链接的可读报告。只用 `--as user` 时，CLI 代表已登录的使用者发消息。使用独立应用机器人身份时，另按租户规则邀请该机器人，并确认目标助手支持机器人消息。
4. 用下方命令获取群 ID 和助手 open_id。若群重名，用群成员确认目标。成员列表里按名称核对用户或机器人，保存当前 CLI 应用返回的 open_id。

```bash
lark-cli im +chat-search --as user --query "<群名>"
lark-cli im +chat-members-list --as user --chat-id "<群ID>" --member-id-type open_id --page-all
```

在任务工作目录创建 `feishu-product-docs.local.json`，以 [config.example.json](config.example.json) 为模板，填写 `chat`、`assistants.research` 和需要时的 `assistants.bi`。也可以把配置放在本地其他目录，在任务中指定文件路径。可选语音接入见 [语音取数](references/voice-data.md)。

本地配置只写群和助手标识及可选的数据源配置。凭证留在飞书 CLI 或已接入的客户端。提交 GitHub 时检查配置、内部链接、消息和查询结果都留在私有环境。若技能目录装在其他项目里，把本地配置放到仓库之外或加入该项目的忽略规则。

## 五、验证后开始使用

- **群内提问。** 按 [群内提问操作](references/feishu-workflow.md) 用 `--dry-run` 检查接收群和内容。在一条获授权的任务里发出真实 @，查看目标助手是否回复。群里看到消息但助手没回时，检查返回结果的 `mentions`、发件身份和话题线程。仍未触发时，可由使用者在飞书手动 @，再把报告和原始链接交给技能。
- **原文读取。** 用 `lark-cli docs +fetch --as user --doc "<可访问的飞书文档链接>" --doc-format markdown` 读取一份已知可访问的文档。让资料助手提供可读的完整报告，并验证报告引用的关键纪要、需求文档或消息也能打开。
- **文档交付。** 在首个获授权的交付中，写入指定位置，再用 CLI 回读标题、高亮、表格和流程图。暂时缺少写权限时，先提供可审阅的 Markdown。

例如在 Codex 中输入：

> 用 $feishu-product-docs 写一份产品对比，先检索历史纪要和原始方案，再在飞书输出对比表。

> 用 $feishu-product-docs 写一份 PRD。先整理旧版规则和影响范围，写清保留、变更和下线策略。需要先做数据分析。

查看 [技能入口](SKILL.md)、[飞书取材与交付](references/feishu-workflow.md) 和 [PRD 写作标准](references/prd-writing.md)。
