#include<iostream>
#include<string>
#include<vector>
#include<windows.h>
class Student //定义一个studnet类
{
    private:
        std::string name;
        int id;
        float score;
    public:
        Student(const std::string& newname, int newid, float newscore);
        const std::string& getName() const;
        int getId() const;
        float getScore() const;
        bool setscore(float newscore);
        void showInfo() const;
};
Student::student(const std::string& newname,int newid,float newscore):
name(newname),id(newid),score(newscore)
{
    //构造函数
}

int Student::getId() const
{
    return id;
}
float Student::getScore() const
{
    return score;
}
bool Student::setscore(float newscore)
