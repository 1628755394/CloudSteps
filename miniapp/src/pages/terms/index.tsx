/**
 * 用户协议 — 对齐 web/src/pages/Terms.tsx。
 */
import React from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import './index.scss'

export default function Terms() {
  return (
    <ScrollView className="doc" scrollY enableFlex>
      <View className="doc__card">
        <Text className="doc__intro">
          欢迎使用云阶（CloudSteps）。本协议由你与云阶平台运营方（以下称"我们"）共同缔结，具有合同效力。
          你在注册、登录或使用本产品服务之前，请认真阅读并充分理解本协议。
          如你不同意本协议任何条款，请立即停止使用。
        </Text>

        <View className="doc__section">
          <Text className="doc__h2">1. 账户与使用资格</Text>
          <Text className="doc__p">
            你应保证你提供的注册信息真实、准确、完整并及时更新。
            你应妥善保管账户及密码（含验证码、令牌等认证信息），因你保管不善导致的后果由你自行承担。
          </Text>
        </View>

        <View className="doc__section">
          <Text className="doc__h2">2. 服务内容</Text>
          <Text className="doc__p">
            我们向你提供学习训练相关的产品功能与技术服务。具体功能以产品实际提供为准。
            我们有权基于业务需要对服务进行升级、变更、中断或终止，并将以合理方式通知。
          </Text>
        </View>

        <View className="doc__section">
          <Text className="doc__h2">3. 用户行为规范</Text>
          <Text className="doc__p">你在使用服务过程中不得从事以下行为：</Text>
          <View className="doc__list">
            <Text className="doc__list-item">• 违反法律法规、监管政策或公序良俗的行为。</Text>
            <Text className="doc__list-item">• 侵害他人合法权益，包括但不限于名誉权、隐私权、知识产权等。</Text>
            <Text className="doc__list-item">• 未经授权访问、干扰、破坏系统或数据的行为（含爬虫、注入、漏洞利用等）。</Text>
            <Text className="doc__list-item">• 制作、发布、传播违法或不良信息。</Text>
          </View>
        </View>

        <View className="doc__section">
          <Text className="doc__h2">4. 知识产权</Text>
          <Text className="doc__p">
            本产品的界面、图形、标识、代码、文档等内容的知识产权归我们或相关权利人所有。
            未经授权，你不得复制、修改、传播、反向工程或用于任何商业目的。
          </Text>
        </View>

        <View className="doc__section">
          <Text className="doc__h2">5. 免责声明</Text>
          <Text className="doc__p">
            我们将尽力保障服务可用性，但不对服务的持续性、无错误或完全符合你的需求作出保证。
            因不可抗力、网络故障、第三方原因等导致的服务异常，我们在法律允许范围内不承担责任。
          </Text>
        </View>

        <View className="doc__section">
          <Text className="doc__h2">6. 协议变更与终止</Text>
          <Text className="doc__p">
            我们可根据法律法规或业务调整需要更新本协议。更新后协议自公布或提示之日起生效。
            若你继续使用服务，视为接受更新后的协议。
          </Text>
        </View>

        <View className="doc__section">
          <Text className="doc__h2">7. 争议解决</Text>
          <Text className="doc__p">
            本协议的订立、执行与解释及争议解决均适用中华人民共和国法律。
            因本协议产生的争议，双方应友好协商解决；协商不成的，提交有管辖权的人民法院解决。
          </Text>
        </View>
      </View>

      <View className="doc__footer">
        <Text className="doc__footer-text">生效日期：2026-03-26</Text>
      </View>
    </ScrollView>
  )
}
